// Razorpay webhook handler
// Processes post-verification payment events (failed, refunded, disputed) so that
// locally-verified payment records are reconciled when Razorpay reverses a charge.
//
// IMPORTANT: This route must receive the raw request body to validate the
// X-Razorpay-Signature header. It must be mounted BEFORE express.json() in app.ts,
// using express.raw({ type: "application/json" }) on this path.

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db, payments } from "@workspace/db";
import { eq, and, notInArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Terminal adverse states — once a payment reaches one of these, it must not be
// overwritten by a duplicate or reordered webhook delivery.
const TERMINAL_ADVERSE_STATUSES = ["refunded", "disputed"] as const;

// POST /webhooks/razorpay — receive Razorpay event notifications
router.post("/razorpay", async (req: Request, res: Response) => {
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

  if (expectedSignature !== signature) {
    logger.warn("Razorpay webhook signature mismatch — rejecting");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
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

async function handleEvent(event: { event: string; payload?: Record<string, unknown> }) {
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

async function markPaymentByOrderId(razorpayOrderId: string, newStatus: string) {
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
    .returning({ id: payments.id, prevStatus: payments.status });

  logger.info(
    { razorpayOrderId, newStatus, updated: result.length },
    "Payment status updated via webhook (by order ID)",
  );
}

async function markPaymentByPaymentId(razorpayPaymentId: string, newStatus: string) {
  const result = await db
    .update(payments)
    .set({ status: newStatus })
    .where(
      and(
        eq(payments.razorpayPaymentId, razorpayPaymentId),
        notInArray(payments.status, [...TERMINAL_ADVERSE_STATUSES]),
      ),
    )
    .returning({ id: payments.id, prevStatus: payments.status });

  logger.info(
    { razorpayPaymentId, newStatus, updated: result.length },
    "Payment status updated via webhook (by payment ID)",
  );
}

export default router;
