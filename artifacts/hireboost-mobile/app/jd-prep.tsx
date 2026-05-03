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
import { useJdPrep } from "@/hooks/useApi";

interface Question {
  question: string;
  modelAnswer: string;
  tip: string;
  category: string;
}

export default function JdPrepScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<{
    roleInsights: { title: string; seniority: string; keySkills: string[]; responsibilities: string[] };
    questions: Question[];
  } | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  const jdPrep = useJdPrep();

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      Alert.alert("Missing JD", "Please paste a job description first.");
      return;
    }
    try {
      const data = await jdPrep.mutateAsync({ jobDescription: jobDescription.trim() });
      setResult(data);
      setExpandedQ(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to analyze JD");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "JD Interview Prep" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          Paste a job description to get tailored interview questions with model answers.
        </Text>

        <TextInput
          style={[styles.textArea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Paste job description here..."
          placeholderTextColor={colors.mutedForeground}
          value={jobDescription}
          onChangeText={setJobDescription}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }, jdPrep.isPending && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={jdPrep.isPending}
        >
          {jdPrep.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="flash-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Analyze JD</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <>
            <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Role Insights</Text>
              <View style={styles.insightRow}>
                <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
                <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>Title</Text>
                <Text style={[styles.insightValue, { color: colors.foreground }]}>{result.roleInsights.title}</Text>
              </View>
              <View style={styles.insightRow}>
                <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
                <Text style={[styles.insightLabel, { color: colors.mutedForeground }]}>Seniority</Text>
                <Text style={[styles.insightValue, { color: colors.foreground }]}>{result.roleInsights.seniority}</Text>
              </View>
              <Text style={[styles.subHeading, { color: colors.foreground }]}>Key Skills</Text>
              <View style={styles.chipRow}>
                {result.roleInsights.keySkills.map((s, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.chipText, { color: colors.primary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {result.questions.length} Interview Questions
            </Text>

            {result.questions.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.qCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setExpandedQ(expandedQ === i ? null : i)}
                activeOpacity={0.85}
              >
                <View style={styles.qHeader}>
                  <View style={[styles.qNum, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.qNumText, { color: colors.primaryForeground }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.qText, { color: colors.foreground }]} numberOfLines={expandedQ === i ? undefined : 2}>
                    {q.question}
                  </Text>
                  <Ionicons name={expandedQ === i ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </View>

                {expandedQ === i && (
                  <View style={styles.qBody}>
                    <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.catText, { color: colors.mutedForeground }]}>{q.category}</Text>
                    </View>
                    <Text style={[styles.answerLabel, { color: colors.foreground }]}>Model Answer</Text>
                    <Text style={[styles.answerText, { color: colors.mutedForeground }]}>{q.modelAnswer}</Text>
                    {q.tip && (
                      <View style={[styles.tipBox, { backgroundColor: colors.primary + "15" }]}>
                        <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                        <Text style={[styles.tipText, { color: colors.foreground }]}>{q.tip}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.copyRow}
                      onPress={() => { Clipboard.setStringAsync(`Q: ${q.question}\n\nA: ${q.modelAnswer}`); Alert.alert("Copied!"); }}
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.copyText, { color: colors.mutedForeground }]}>Copy Q&A</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textArea: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 160, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  btn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  insightCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  insightLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 60 },
  insightValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  subHeading: { fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  qCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14 },
  qNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  qNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  qText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  qBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  catBadge: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  catText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  answerLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  answerText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  tipBox: { flexDirection: "row", gap: 8, borderRadius: 8, padding: 10, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  copyText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
