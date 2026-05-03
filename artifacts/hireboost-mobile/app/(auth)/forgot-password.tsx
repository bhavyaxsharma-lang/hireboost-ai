import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type Step = "email" | "otp" | "done";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendOtp, verifyOtpReset } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email.trim()) { setError("Enter your email address."); return; }
    try {
      setError("");
      setLoading(true);
      await sendOtp(email.trim().toLowerCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("otp");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp.trim() || otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    try {
      setError("");
      setLoading(true);
      await verifyOtpReset(email.trim().toLowerCase(), otp.trim(), newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === "email" ? 0 : step === "otp" ? 1 : 2;

  if (step === "done") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Ionicons name="checkmark-circle" size={72} color={colors.primary} />
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>Password Reset!</Text>
        <Text style={[styles.doneMsg, { color: colors.mutedForeground }]}>Your password has been updated. Sign in with your new password.</Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32, width: "100%" }]}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => (step === "otp" ? setStep("email") : router.back())} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === "email" ? "Forgot Password" : "Reset Password"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {step === "email"
            ? "We'll email you a 6-digit code to reset your password."
            : `Enter the OTP sent to ${email} and choose a new password.`}
        </Text>

        <View style={styles.steps}>
          {["Email", "OTP & Password"].map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, { backgroundColor: i <= stepIndex ? colors.primary : colors.muted }]}>
                {i < stepIndex ? (
                  <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.stepNum, { color: i <= stepIndex ? colors.primaryForeground : colors.mutedForeground }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: i <= stepIndex ? colors.foreground : colors.mutedForeground }]}>{s}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === "email" && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>Email Address</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>
        )}

        {step === "otp" && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>6-Digit OTP</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="key-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="123456"
                  placeholderTextColor={colors.mutedForeground}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPw}
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={8}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
          onPress={step === "email" ? handleSendOtp : handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
              {step === "email" ? "Send OTP" : "Reset Password"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24 },
  backBtn: { marginBottom: 24, width: 40 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 24 },
  steps: { flexDirection: "row", gap: 20, marginBottom: 24 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  stepLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  errorText: { color: "#EF4444", fontSize: 13 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  doneTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginTop: 20, marginBottom: 12 },
  doneMsg: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
