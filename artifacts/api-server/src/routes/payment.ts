import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db, payments } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const RESUME_PRICE_PAISE = 9900; // ₹99

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /payment/create-order — creates a Razorpay order for ₹99
router.post("/create-order", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: RESUME_PRICE_PAISE,
      currency: "INR",
      receipt: `resume_${userId}_${Date.now()}`,
    });

    await db.insert(payments).values({
      userId,
      razorpayOrderId: order.id,
      amountPaise: RESUME_PRICE_PAISE,
      status: "pending",
      used: 0,
    });

    res.json({
      orderId: order.id,
      amount: RESUME_PRICE_PAISE,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    req.log.error({ err }, "Error creating Razorpay order");
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// POST /payment/verify — verify Razorpay signature after successful payment
router.post("/verify", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment details" });
    return;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    res.status(500).json({ error: "Payment configuration error" });
    return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    res.status(400).json({ error: "Invalid payment signature" });
    return;
  }

  try {
    // Server-to-server confirmation: fetch the payment from Razorpay and verify
    // it is actually captured and belongs to the declared order before granting credit.
    const razorpay = getRazorpay();

    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

    if (paymentDetails.status !== "captured") {
      req.log.warn(
        { razorpay_payment_id, status: paymentDetails.status },
        "Payment not captured; refusing to grant credit",
      );
      res.status(402).json({ error: "Payment has not been captured" });
      return;
    }

    // Reject payments that are fully or partially refunded.
    // Razorpay keeps status="captured" during refund processing, so we must
    // check refund_status and amount_refunded separately.
    const refundStatus = paymentDetails.refund_status as string | null | undefined;
    const amountRefunded = Number(paymentDetails.amount_refunded ?? 0);
    if (refundStatus === "full" || refundStatus === "partial" || amountRefunded > 0) {
      req.log.warn(
        { razorpay_payment_id, refundStatus, amountRefunded },
        "Payment has been refunded; refusing to grant credit",
      );
      res.status(402).json({ error: "Payment has been refunded" });
      return;
    }

    // Reject payments that have an active or lost dispute.
    // A disputed payment may still show status="captured" and refund_status="null"
    // until the dispute is resolved, so we must query Razorpay's disputes API
    // directly. Disputes with status "won" or "closed" are harmless — the merchant
    // prevailed or the dispute was withdrawn without loss.
    const ADVERSE_DISPUTE_STATUSES = new Set(["open", "under_review", "lost"]);
    try {
      // The TypeScript type only declares RazorpayPaginationOptions but Razorpay's
      // REST API accepts `payment_id` as a query filter; cast to pass it through.
      const disputeList = await razorpay.disputes.all(
        { payment_id: razorpay_payment_id } as Parameters<typeof razorpay.disputes.all>[0],
      );
      const adverseDispute = disputeList.items.find((d) =>
        ADVERSE_DISPUTE_STATUSES.has(d.status),
      );
      if (adverseDispute) {
        req.log.warn(
          { razorpay_payment_id, disputeId: adverseDispute.id, disputeStatus: adverseDispute.status },
          "Payment has an active or lost dispute; refusing to grant credit",
        );
        res.status(402).json({ error: "Payment is under dispute" });
        return;
      }
    } catch (err) {
      // If the disputes endpoint is unavailable (e.g. credentials lack dispute scope),
      // behaviour is controlled by PAYMENT_VERIFY_REQUIRE_DISPUTE_CHECK:
      //   true  → fail-closed: reject the verify request so no credit is granted
      //           while dispute-API access is degraded.
      //   false (default) → fail-open: log and continue, relying on the webhook
      //           reconciliation path (order-ID fallback) for defence-in-depth.
      req.log.warn({ err, razorpay_payment_id }, "Could not fetch disputes from Razorpay");
      if (process.env.PAYMENT_VERIFY_REQUIRE_DISPUTE_CHECK === "true") {
        req.log.error({ razorpay_payment_id }, "Dispute check required but failed — rejecting verify");
        res.status(503).json({ error: "Unable to verify payment safety; please try again" });
        return;
      }
      req.log.warn({ razorpay_payment_id }, "Dispute check skipped (fail-open); webhook reconciliation provides defence-in-depth");
    }

    if (paymentDetails.order_id !== razorpay_order_id) {
      req.log.warn(
        { razorpay_payment_id, declared_order: razorpay_order_id, actual_order: paymentDetails.order_id },
        "Payment order_id mismatch; refusing to grant credit",
      );
      res.status(400).json({ error: "Payment order mismatch" });
      return;
    }

    const orderDetails = await razorpay.orders.fetch(razorpay_order_id);

    if (orderDetails.status !== "paid") {
      req.log.warn(
        { razorpay_order_id, status: orderDetails.status },
        "Order not paid; refusing to grant credit",
      );
      res.status(402).json({ error: "Order has not been paid" });
      return;
    }

    const updated = await db
      .update(payments)
      .set({
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "verified",
      })
      .where(
        and(
          eq(payments.razorpayOrderId, razorpay_order_id),
          eq(payments.userId, userId),
          eq(payments.status, "pending"),
        ),
      )
      .returning({ id: payments.id });

    if (updated.length === 0) {
      req.log.warn(
        { razorpay_order_id, userId },
        "No pending payment row found to verify — already processed, missing, or owned by another user",
      );
      res.status(409).json({ error: "Payment record not found or already processed" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error verifying payment");
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

export default router;
