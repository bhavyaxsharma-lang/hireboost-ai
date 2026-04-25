import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db, payments } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const RESUME_PRICE_PAISE = 10000; // ₹100

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /payment/create-order — creates a Razorpay order for ₹100
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
    await db
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
        ),
      );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error verifying payment");
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

export default router;
