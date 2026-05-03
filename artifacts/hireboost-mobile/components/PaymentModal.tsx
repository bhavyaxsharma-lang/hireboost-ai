import { Ionicons } from "@expo/vector-icons";
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

// Lazy-load WebView only on native — react-native-webview has no web support
const NativeWebView = Platform.OS !== "web"
  ? (require("react-native-webview") as typeof import("react-native-webview")).WebView
  : null;

type WebViewMessageEvent = {
  nativeEvent: { data: string };
};

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
  const webViewRef = useRef<unknown>(null);

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
      const msg = JSON.parse(event.nativeEvent.data) as {
        type: string;
        data: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        };
      };
      if (msg.type === "PAYMENT_SUCCESS") {
        onSuccess(msg.data);
      } else if (msg.type === "PAYMENT_DISMISSED") {
        onDismiss();
      }
    } catch {
      // ignore parse errors
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

        {NativeWebView ? (
          <NativeWebView
            ref={webViewRef as React.RefObject<InstanceType<typeof NativeWebView>>}
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
        ) : (
          // Web fallback — payments require the native Android app
          <View style={styles.webFallback}>
            <Ionicons name="phone-portrait-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>
              Use the Android App
            </Text>
            <Text style={[styles.webFallbackDesc, { color: colors.mutedForeground }]}>
              Razorpay payments are only available in the HireBoost AI Android app. Open the app on your device to complete this purchase.
            </Text>
            <TouchableOpacity
              style={[styles.closeTextBtn, { backgroundColor: colors.muted }]}
              onPress={onDismiss}
            >
              <Text style={[styles.closeTextBtnLabel, { color: colors.foreground }]}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
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
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  webFallbackTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  webFallbackDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    textAlign: "center",
  },
  closeTextBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeTextBtnLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
