import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnalyzeResume, useGetResumeHistory } from "@workspace/api-client-react";
import { ATSRing } from "@/components/ATSRing";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { PaymentModal } from "@/components/PaymentModal";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useParseFile, useResumeRewrite, useRewriteStatus, useCreateOrder, useVerifyPayment } from "@/hooks/useApi";

type Tab = "input" | "results";

export default function ResumeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [tab, setTab] = useState<Tab>("input");
  const [resumeText, setResumeText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [analysis, setAnalysis] = useState<{
    id: number;
    atsScore: number;
    missingKeywords: string[];
    suggestions: string[];
    strengths: string[];
    overallFeedback: string;
    resumeText: string;
  } | null>(null);
  const [rewrittenText, setRewrittenText] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<{ orderId: string; amount: number; currency: string; key: string } | null>(null);

  const { data: rewriteStatus, refetch: refetchStatus } = useRewriteStatus();
  const { data: history } = useGetResumeHistory({});

  const analyze = useAnalyzeResume();
  const parseFile = useParseFile();
  const rewrite = useResumeRewrite();
  const createOrder = useCreateOrder();
  const verifyPayment = useVerifyPayment();

  const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const formData = new FormData();
      formData.append("resume", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/octet-stream",
      } as unknown as Blob);

      const parsed = await parseFile.mutateAsync(formData);
      setResumeText(parsed.text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not read file");
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      Alert.alert("Missing Resume", "Please paste or upload your resume first.");
      return;
    }
    try {
      const result = await analyze.mutateAsync({
        data: {
          resumeText: resumeText.trim(),
          jobTitle: undefined,
          jobDescription: jobDesc.trim() || undefined,
        },
      });
      setAnalysis(result);
      setTab("results");
      setRewrittenText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Analysis failed");
    }
  };

  const handleRewrite = async () => {
    if (!analysis) return;
    const canRewriteFree = (rewriteStatus?.freeUsed ?? 0) < (rewriteStatus?.freeLimit ?? 1);
    const hasPaid = rewriteStatus?.hasPaidCredit ?? false;

    if (!canRewriteFree && !hasPaid) {
      const order = await createOrder.mutateAsync();
      setPaymentOrder(order);
      return;
    }

    try {
      const result = await rewrite.mutateAsync({ resumeText: analysis.resumeText, analysisId: analysis.id });
      setRewrittenText(result.rewrittenText);
      refetchStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Rewrite failed");
    }
  };

  const handlePaymentSuccess = async (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    setPaymentOrder(null);
    try {
      await verifyPayment.mutateAsync(data);
      refetchStatus();
      Alert.alert("Payment Successful", "Your rewrite credit has been added. Tap Rewrite again.");
    } catch {
      Alert.alert("Payment Error", "Payment recorded but verification failed. Contact support.");
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LoadingOverlay visible={analyze.isPending || rewrite.isPending || createOrder.isPending} message={analyze.isPending ? "Analyzing..." : rewrite.isPending ? "Rewriting..." : "Preparing payment..."} />

      {paymentOrder && user && (
        <PaymentModal
          visible={true}
          orderId={paymentOrder.orderId}
          amount={paymentOrder.amount}
          currency={paymentOrder.currency}
          razorpayKey={paymentOrder.key}
          userEmail={user.email}
          userName={user.name}
          onSuccess={handlePaymentSuccess}
          onDismiss={() => setPaymentOrder(null)}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + webTop, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Resume Analyzer</Text>
        <View style={styles.tabs}>
          {(["input", "results"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, t === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: t === tab ? colors.primary : colors.mutedForeground }]}>
                {t === "input" ? "Input" : "Analysis"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled">
        {tab === "input" ? (
          <>
            <TouchableOpacity
              style={[styles.uploadBtn, { borderColor: colors.primary, backgroundColor: colors.primary + "15" }]}
              onPress={handlePickFile}
              disabled={parseFile.isPending}
            >
              {parseFile.isPending ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                  <Text style={[styles.uploadText, { color: colors.primary }]}>Upload PDF / DOCX</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.orLabel, { color: colors.mutedForeground }]}>— or paste below —</Text>

            <TextInput
              style={[styles.textArea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Paste your resume text here..."
              placeholderTextColor={colors.mutedForeground}
              value={resumeText}
              onChangeText={setResumeText}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Job Description (optional)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground, minHeight: 100 }]}
              placeholder="Paste the job description to target your analysis..."
              placeholderTextColor={colors.mutedForeground}
              value={jobDesc}
              onChangeText={setJobDesc}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleAnalyze}
              disabled={analyze.isPending}
              activeOpacity={0.85}
            >
              <Ionicons name="flash-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Analyze Resume</Text>
            </TouchableOpacity>

            {history && history.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Analyses</Text>
                {history.slice(0, 5).map((h) => (
                  <View key={h.id} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.scoreBadge, { backgroundColor: h.atsScore >= 80 ? "#DCFCE7" : h.atsScore >= 60 ? "#FEF9C3" : "#FEE2E2" }]}>
                      <Text style={[styles.scoreBadgeText, { color: h.atsScore >= 80 ? "#16A34A" : h.atsScore >= 60 ? "#CA8A04" : "#DC2626" }]}>
                        {h.atsScore}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.histTitle, { color: colors.foreground }]}>{h.jobTitle ?? "Resume Analysis"}</Text>
                      <Text style={[styles.histDate, { color: colors.mutedForeground }]}>
                        {new Date(h.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        ) : analysis ? (
          <>
            <View style={styles.scoreRow}>
              <ATSRing score={analysis.atsScore} size={140} />
              <View style={styles.scoreSummary}>
                <Text style={[styles.scoreFeedback, { color: colors.foreground }]} numberOfLines={4}>
                  {analysis.overallFeedback}
                </Text>
              </View>
            </View>

            {analysis.strengths.length > 0 && (
              <Section title="Strengths" icon="checkmark-circle-outline" iconColor="#22C55E">
                {analysis.strengths.map((s, i) => (
                  <Chip key={i} text={s} colors={colors} bgColor="#DCFCE7" textColor="#16A34A" />
                ))}
              </Section>
            )}

            {analysis.missingKeywords.length > 0 && (
              <Section title="Missing Keywords" icon="close-circle-outline" iconColor="#EF4444">
                <View style={styles.chipRow}>
                  {analysis.missingKeywords.map((k, i) => (
                    <Chip key={i} text={k} colors={colors} bgColor="#FEE2E2" textColor="#DC2626" />
                  ))}
                </View>
              </Section>
            )}

            {analysis.suggestions.length > 0 && (
              <Section title="Suggestions" icon="bulb-outline" iconColor="#F59E0B">
                {analysis.suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionRow}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                  </View>
                ))}
              </Section>
            )}

            {rewrittenText ? (
              <Section title="Rewritten Resume" icon="sparkles-outline" iconColor={colors.primary}>
                <Text style={[styles.rewrittenText, { color: colors.foreground, backgroundColor: colors.muted }]}>
                  {rewrittenText}
                </Text>
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: colors.primary }]}
                  onPress={() => { Clipboard.setStringAsync(rewrittenText); Alert.alert("Copied", "Resume copied to clipboard."); }}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                  <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Copy to Clipboard</Text>
                </TouchableOpacity>
              </Section>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleRewrite}
                disabled={rewrite.isPending || createOrder.isPending}
                activeOpacity={0.85}
              >
                <Ionicons name="sparkles-outline" size={18} color={colors.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  {(rewriteStatus?.freeUsed ?? 0) < (rewriteStatus?.freeLimit ?? 1)
                    ? "Auto-Fix Resume (Free)"
                    : rewriteStatus?.hasPaidCredit
                    ? "Auto-Fix Resume (Credit)"
                    : "Auto-Fix Resume (₹99)"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.outlineBtn, { borderColor: colors.border, marginTop: 8 }]} onPress={() => { setTab("input"); setRewrittenText(""); }}>
              <Ionicons name="arrow-back-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.outlineBtnText, { color: colors.mutedForeground }]}>Analyze Another</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyResults}>
            <Ionicons name="document-text-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No analysis yet. Go to Input tab to get started.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, icon, iconColor, children }: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"]; iconColor: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={iconColor} />
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Chip({ text, bgColor, textColor }: { text: string; bgColor: string; textColor: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.chip, { backgroundColor: bgColor }]}>
      <Text style={[styles.chipText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", paddingTop: 16, marginBottom: 8 },
  tabs: { flexDirection: "row" },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 8 },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 12 },
  uploadBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  uploadText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  orLabel: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular" },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    minHeight: 160,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 10 },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  scoreBadge: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  scoreBadgeText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  histTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  histDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 8 },
  scoreSummary: { flex: 1 },
  scoreFeedback: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  section: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  suggestionRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  suggestionText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  rewrittenText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, padding: 12, borderRadius: 8 },
  outlineBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyResults: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
});
