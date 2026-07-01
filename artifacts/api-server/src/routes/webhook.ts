// Razorpay webhook handler
// Processes post-verification payment events (failed, refunded, disputed) so that
// locally-verified payment records are reconciled when Razorpay reverses a charge.
//
// IMPORTANT: This route must receive the raw request body to validate the
// X-Razorpay-Signature header. It must be mounted BEFORE express.json() in app.ts,
// using express.raw({ type: "application/json" }) on this path.

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { db, payments } from "@workspace/db";
import { eq, and, notInArray } from "drizzle-orm";
import { logger } from "../lib/logger";

function getRazorpay(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

const router = Router();

// Terminal adverse states — once a payment reaches one of these, it must not be
// overwritten by a duplicate or reordered webhook delivery.
const TERMINAL_ADVERSE_STATUSES = ["refunded", "disputed"] as const;

// POST /webhooks/razorpay — receive Razorpay event notifications
router.post("/razorpay", async (req: Request, res: Response): Promise<Response | void> => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("RAZORPAY_WEBHOOK_SECRET is not configured");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  // req.body is a Buffer when mounted with express.raw()
  const rawBody: Buffer = req.body as Buffer;
  const signature = req.headers["x-razorpay-signature"];

  if (!signature || typeof signature !== "string") {
    res.status(400).json({ error: "Missing webhook signature" });
    return;
  }

  const expectedSignature = crypto
  .createHmac("sha256", webhookSecret)
  .update(rawBody)
  .digest("hex");

const expectedBuffer = Buffer.from(
  expectedSignature,
  "utf8",
);

const actualBuffer = Buffer.from(
  signature,
  "utf8",
);

if (
  expectedBuffer.length !== actualBuffer.length ||
  !crypto.timingSafeEqual(
    expectedBuffer,
    actualBuffer,
  )
) {
  logger.error(
    "Razorpay webhook signature mismatch — rejecting. Check RAZORPAY_WEBHOOK_SECRET matches the Razorpay dashboard value.",
  );

  return res.status(400).json({
    error: "Invalid webhook signature",
  });
}
   
  let event: { event: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as typeof event;
  } catch {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  try {
    // Process synchronously before ACKing so Razorpay retries on transient DB failures.
    await handleEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.event }, "Error processing Razorpay webhook event");
    // Return 500 so Razorpay retries the delivery
    res.status(500).json({ error: "Failed to process webhook event" });
  }
});

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
};

type RazorpayRefundEntity = {
  id?: string;
  payment_id?: string;
};

type RazorpayDisputeEntity = {
  payment_id?: string;
};

async function handleEvent(event: { event: string; payload?: Record<string, unknown> }): Promise<void> {
  const eventType = event.event;
  logger.info({ eventType }, "Processing Razorpay webhook event");

  switch (eventType) {
    case "payment.failed": {
      const payment = (event.payload?.payment as { entity?: RazorpayPaymentEntity } | undefined)?.entity;
      if (!payment?.order_id) break;
      await markPaymentByOrderId(payment.order_id, "failed");
      break;
    }

    case "refund.created":
    case "refund.processed": {
      // Razorpay refund events carry a `refund` entity (not a `payment` entity).
      // The refund entity's `payment_id` links back to the original payment.
      const refund = (event.payload?.refund as { entity?: RazorpayRefundEntity } | undefined)?.entity;
      if (!refund?.payment_id) break;
      await markPaymentByPaymentId(refund.payment_id, "refunded");
      break;
    }

    case "payment.dispute.created":
    case "payment.dispute.lost": {
      const dispute = (event.payload?.dispute as { entity?: RazorpayDisputeEntity } | undefined)?.entity;
      if (!dispute?.payment_id) break;
      await markPaymentByPaymentId(dispute.payment_id, "disputed");
      break;
    }

    default:
      logger.info({ eventType }, "Unhandled Razorpay webhook event type — ignoring");
  }
}

async function markPaymentByOrderId(razorpayOrderId: string, newStatus: string): Promise<void> {
  // Transition guard: only update if the current status is not already a terminal
  // adverse state. This ensures idempotent behaviour on duplicate deliveries and
  // prevents a less severe event from overwriting a more severe one.
  const result = await db
    .update(payments)
    .set({ status: newStatus })
    .where(
      and(
        eq(payments.razorpayOrderId, razorpayOrderId),
        notInArray(payments.status, [...TERMINAL_ADVERSE_STATUSES]),
      ),
    )
    .returning({
  id: payments.id,
});

  logger.info(
    { razorpayOrderId, newStatus, updated: result.length },
    "Payment status updated via webhook (by order ID)",
  );
}

async function markPaymentByPaymentId(razorpayPaymentId: string, newStatus: string): Promise<void> {
  const result = await db
    .update(payments)
    .set({ status: newStatus })
    .where(
      and(
        eq(payments.razorpayPaymentId, razorpayPaymentId),
        notInArray(payments.status, [...TERMINAL_ADVERSE_STATUSES]),
      ),
    )
    .returning({
  id: payments.id,
});

  logger.info(
    { razorpayPaymentId, newStatus, updated: result.length },
    "Payment status updated via webhook (by payment ID)",
  );

  if (result.length === 0) {
    // The local row may not yet have razorpayPaymentId stored (client hasn't called
    // /payment/verify yet). Fetch from Razorpay to get the associated order_id, then
    // mark by order_id so the adverse event is not silently dropped.
    const razorpay = getRazorpay();
    if (!razorpay) {
      logger.warn({ razorpayPaymentId, newStatus }, "Cannot do order-ID fallback: Razorpay not configured");
      return;
    }

    let orderId: string | undefined;
    try {
      const payment = await razorpay.payments.fetch(razorpayPaymentId);
      orderId = payment.order_id as string | undefined;
    } catch (err) {
      logger.error({ err, razorpayPaymentId }, "Failed to fetch payment from Razorpay for order-ID fallback");
      return;
    }

    if (!orderId) {
      logger.warn({ razorpayPaymentId }, "Razorpay payment has no order_id — cannot do fallback lookup");
      return;
    }

    // Also store the razorpayPaymentId on the row so future lookups by payment_id succeed.
    const fallbackResult = await db
      .update(payments)
      .set({ status: newStatus, razorpayPaymentId })
      .where(
        and(
          eq(payments.razorpayOrderId, orderId),
          notInArray(payments.status, [...TERMINAL_ADVERSE_STATUSES]),
        ),
      )
      .returning({ id: payments.id });

    logger.info(
      { razorpayPaymentId, orderId, newStatus, updated: fallbackResult.length },
      "Payment status updated via webhook (by order ID fallback)",
    );
  }
}

export default router;
