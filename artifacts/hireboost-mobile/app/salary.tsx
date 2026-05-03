import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useSalaryGenerate } from "@/hooks/useApi";

interface SalaryResult {
  counterOffer: number;
  marketInsights: string[];
  negotiationTips: string[];
  verbalScript: string;
  emailTemplate: string;
}

type ActiveScript = "verbal" | "email" | null;

export default function SalaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [jobRole, setJobRole] = useState("");
  const [experience, setExperience] = useState("");
  const [currentCtc, setCurrentCtc] = useState("");
  const [offeredCtc, setOfferedCtc] = useState("");
  const [result, setResult] = useState<SalaryResult | null>(null);
  const [activeScript, setActiveScript] = useState<ActiveScript>(null);

  const generate = useSalaryGenerate();

  const handleGenerate = async () => {
    if (!jobRole.trim() || !experience || !offeredCtc) {
      Alert.alert("Missing Info", "Please fill in all required fields.");
      return;
    }
    try {
      const data = await generate.mutateAsync({
        jobRole: jobRole.trim(),
        experience: Number(experience),
        currentCtc: Number(currentCtc) || 0,
        offeredCtc: Number(offeredCtc),
      });
      setResult(data);
      setActiveScript(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Generation failed");
    }
  };

  const fields = [
    { label: "Job Role *", value: jobRole, setter: setJobRole, placeholder: "e.g. Software Engineer", keyboard: "default" as const },
    { label: "Experience (years) *", value: experience, setter: setExperience, placeholder: "e.g. 4", keyboard: "numeric" as const },
    { label: "Current CTC (₹ LPA)", value: currentCtc, setter: setCurrentCtc, placeholder: "e.g. 8", keyboard: "numeric" as const },
    { label: "Offered CTC (₹ LPA) *", value: offeredCtc, setter: setOfferedCtc, placeholder: "e.g. 12", keyboard: "numeric" as const },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Salary Negotiation" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          Get AI-powered counter-offers and negotiation scripts tailored to your role and market.
        </Text>

        {fields.map((f) => (
          <View key={f.label}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{f.label}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder={f.placeholder}
                placeholderTextColor={colors.mutedForeground}
                value={f.value}
                onChangeText={f.setter}
                keyboardType={f.keyboard}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#F59E0B" }, generate.isPending && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generate.isPending}
        >
          {generate.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cash-outline" size={18} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>Generate Strategy</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <>
            <View style={[styles.counterCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <Text style={[styles.counterLabel, { color: "#92400E" }]}>Recommended Counter-Offer</Text>
              <Text style={[styles.counterValue, { color: "#B45309" }]}>₹{result.counterOffer} LPA</Text>
              <Text style={[styles.counterDiff, { color: "#92400E" }]}>
                +₹{(result.counterOffer - Number(offeredCtc)).toFixed(1)} more than offered
              </Text>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Market Insights</Text>
              {result.marketInsights.map((insight, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={[styles.bulletText, { color: colors.foreground }]}>{insight}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Negotiation Tips</Text>
              {result.negotiationTips.map((tip, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.bulletText, { color: colors.foreground }]}>{tip}</Text>
                </View>
              ))}
            </View>

            <View style={styles.scriptBtns}>
              <TouchableOpacity
                style={[styles.scriptBtn, { backgroundColor: activeScript === "verbal" ? colors.primary : colors.muted, borderColor: colors.border }]}
                onPress={() => setActiveScript(activeScript === "verbal" ? null : "verbal")}
              >
                <Ionicons name="mic-outline" size={16} color={activeScript === "verbal" ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.scriptBtnText, { color: activeScript === "verbal" ? colors.primaryForeground : colors.mutedForeground }]}>Verbal Script</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scriptBtn, { backgroundColor: activeScript === "email" ? colors.primary : colors.muted, borderColor: colors.border }]}
                onPress={() => setActiveScript(activeScript === "email" ? null : "email")}
              >
                <Ionicons name="mail-outline" size={16} color={activeScript === "email" ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.scriptBtnText, { color: activeScript === "email" ? colors.primaryForeground : colors.mutedForeground }]}>HR Email</Text>
              </TouchableOpacity>
            </View>

            {activeScript && (
              <View style={[styles.scriptBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.scriptText, { color: colors.foreground }]}>
                  {activeScript === "verbal" ? result.verbalScript : result.emailTemplate}
                </Text>
                <TouchableOpacity
                  style={styles.copyRow}
                  onPress={() => {
                    Clipboard.setStringAsync(activeScript === "verbal" ? result.verbalScript : result.emailTemplate);
                    Alert.alert("Copied!", "Script copied to clipboard.");
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.copyText, { color: colors.mutedForeground }]}>Copy to clipboard</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  inputRow: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, justifyContent: "center" },
  input: { fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  counterCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", gap: 4 },
  counterLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  counterValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  counterDiff: { fontSize: 13, fontFamily: "Inter_500Medium" },
  section: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  scriptBtns: { flexDirection: "row", gap: 10 },
  scriptBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 10, borderWidth: 1 },
  scriptBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scriptBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  scriptText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  copyText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
