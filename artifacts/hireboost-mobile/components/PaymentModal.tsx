import React, { useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface PaymentModalProps {
  visible: boolean;
  orderId: string;
  amount: number;
  currency: string;
  razorpayKey: string;
  userEmail: string;
  userName: string;
  onSuccess: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onDismiss: () => void;
}

export function PaymentModal({
  visible,
  orderId,
  amount,
  currency,
  razorpayKey,
  userEmail,
  userName,
  onSuccess,
  onDismiss,
}: PaymentModalProps) {
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #09090B; font-family: -apple-system, sans-serif; }
    .btn { background: #A3CC00; color: #18181B; border: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; max-width: 300px; }
    .info { color: #A1A1AA; font-size: 14px; text-align: center; margin-bottom: 20px; }
    .container { text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <p class="info">Tap below to pay ₹${amount / 100}</p>
    <button class="btn" onclick="openRazorpay()">Pay ₹${amount / 100}</button>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function openRazorpay() {
      var options = {
        key: "${razorpayKey}",
        amount: ${amount},
        currency: "${currency}",
        order_id: "${orderId}",
        name: "HireBoost AI",
        description: "Resume Rewrite Credit",
        prefill: { name: "${userName.replace(/"/g, "")}", email: "${userEmail.replace(/"/g, "")}" },
        theme: { color: "#A3CC00" },
        handler: function(response) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "PAYMENT_SUCCESS",
            data: response
          }));
        },
        modal: {
          ondismiss: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PAYMENT_DISMISSED" }));
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    }
    window.onload = function() { setTimeout(openRazorpay, 500); };
  </script>
</body>
</html>`;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "PAYMENT_SUCCESS") {
        onSuccess(msg.data);
      } else if (msg.type === "PAYMENT_DISMISSED") {
        onDismiss();
      }
    } catch {
      // ignore
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <WebView
          ref={webViewRef}
          source={{ html }}
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          style={{ backgroundColor: colors.background }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 4 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
