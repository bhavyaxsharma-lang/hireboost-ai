// Payment routes using Razorpay
import { Router } from "express";
import crypto from "node:crypto";
import { createRequire } from "node:module";

declare module "express-session" {
  interface SessionData {
    verifiedPayments?: string[];
  }
}

const require = createRequire(import.meta.url);

const router = Router();

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// POST /payment/create-order
// Creates a Razorpay order and returns the order details needed for checkout
router.post("/create-order", async (req, res) => {
  const instance = getRazorpayInstance();

  if (!instance) {
    res.status(503).json({
      error: "Payment gateway not configured. Please contact support.",
    });
    return;
  }

  try {
    const order = await instance.orders.create({
      amount: 9900,         // ₹99 in paise
      currency: "INR",
      receipt: `resume_rewrite_${Date.now()}`,
      notes: {
        product: "Resume Auto-Fix",
        userId: String(req.session?.userId ?? "guest"),
      },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create Razorpay order");
    res.status(500).json({ error: "Failed to create payment order." });
  }
});

// POST /payment/verify
// Verifies Razorpay payment signature and marks it as paid in the session
router.post("/verify", (req, res) => {
  const { orderId, paymentId, signature } = req.body as {
    orderId?: string;
    paymentId?: string;
    signature?: string;
  };

  if (!orderId || !paymentId || !signature) {
    res.status(400).json({ error: "Missing payment details." });
    return;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    res.status(503).json({ error: "Payment gateway not configured." });
    return;
  }

  // Verify HMAC SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (expectedSignature !== signature) {
    res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    return;
  }

  // Store verified payment ID in session (one-time use guard)
  if (!req.session.verifiedPayments) {
    req.session.verifiedPayments = [];
  }
  req.session.verifiedPayments.push(paymentId);

  res.json({ success: true, paymentId });
});

export default router;
