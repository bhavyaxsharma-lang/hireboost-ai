import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  useCompleteInterviewSession,
  useGetInterviewSession,
  useSubmitAnswer,
} from "@workspace/api-client-react";
import { StarRating } from "@/components/StarRating";
import { useColors } from "@/hooks/useColors";

export default function InterviewSessionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showModel, setShowModel] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Record<number, { feedback: string; rating: number; suggestions: string[]; modelAnswer?: string }>>({});

  const { data: session, isLoading, refetch } = useGetInterviewSession(sessionId);
  const submitAnswer = useSubmitAnswer();
  const completeSession = useCompleteInterviewSession();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errText, { color: colors.foreground }]}>Session not found.</Text>
      </View>
    );
  }

  const questions = session.questions ?? [];
  const currentQ = questions[currentIdx];
  const isComplete = session.status === "completed";
  const feedback = currentQ ? feedbacks[currentQ.id] : null;

  const handleSubmit = async () => {
    if (!answer.trim() || !currentQ) return;
    try {
      const result = await submitAnswer.mutateAsync({
        id: sessionId,
        data: { questionId: currentQ.id, answer: answer.trim() },
      });
      setFeedbacks((prev) => ({ ...prev, [currentQ.id]: { feedback: result.feedback, rating: result.rating, suggestions: result.suggestions } }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Submission failed");
    }
  };

  const handleNext = () => {
    setAnswer("");
    setShowModel(false);
    setCurrentIdx((prev) => prev + 1);
  };

  const handleComplete = async () => {
    try {
      await completeSession.mutateAsync({ id: sessionId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not complete session");
    }
  };

  if (isComplete) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: "Interview Complete" }} />
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 40 }}>
          <View style={styles.completedHero}>
            <View style={[styles.completedIcon, { backgroundColor: colors.primary + "25" }]}>
              <Ionicons name="trophy" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.completedTitle, { color: colors.foreground }]}>Interview Done!</Text>
            <Text style={[styles.completedRole, { color: colors.mutedForeground }]}>{session.jobRole}</Text>
            {session.averageRating != null && (
              <>
                <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>Average Rating</Text>
                <StarRating rating={session.averageRating} size={28} />
                <Text style={[styles.ratingNum, { color: colors.primary }]}>{session.averageRating.toFixed(1)}/5</Text>
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Review</Text>
          {questions.map((q, i) => {
            const fb = feedbacks[q.id] ?? (q.aiFeedback ? { feedback: q.aiFeedback, rating: q.rating ?? 0, suggestions: [] } : null);
            return (
              <View key={q.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.qNum, { color: colors.mutedForeground }]}>Q{i + 1}</Text>
                <Text style={[styles.qText, { color: colors.foreground }]}>{q.questionText}</Text>
                {q.userAnswer && <Text style={[styles.answerText, { color: colors.mutedForeground }]}>{q.userAnswer}</Text>}
                {fb && (
                  <>
                    <View style={styles.ratingRow}>
                      <StarRating rating={fb.rating} size={16} />
                      <Text style={[styles.ratingNumSmall, { color: colors.primary }]}>{fb.rating}/5</Text>
                    </View>
                    <Text style={[styles.fbText, { color: colors.foreground }]}>{fb.feedback}</Text>
                  </>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)/interview")}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Back to Interviews</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (!currentQ) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errText, { color: colors.foreground }]}>No questions available.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Stack.Screen options={{ title: `${session.jobRole} · ${session.difficulty}` }} />

      <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((currentIdx) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.progressText}>
          <Text style={[styles.qCounter, { color: colors.mutedForeground }]}>Question {currentIdx + 1} of {questions.length}</Text>
          <View style={[styles.diffBadge, { backgroundColor: session.difficulty === "easy" ? "#DCFCE7" : session.difficulty === "medium" ? "#FEF9C3" : "#FEE2E2" }]}>
            <Text style={[styles.diffText, { color: session.difficulty === "easy" ? "#16A34A" : session.difficulty === "medium" ? "#CA8A04" : "#DC2626" }]}>{session.difficulty}</Text>
          </View>
        </View>

        <View style={[styles.questionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.questionText, { color: colors.foreground }]}>{currentQ.questionText}</Text>
        </View>

        {!feedback ? (
          <>
            <Text style={[styles.answerLabel, { color: colors.foreground }]}>Your Answer</Text>
            <TextInput
              style={[styles.answerInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Type your answer here..."
              placeholderTextColor={colors.mutedForeground}
              value={answer}
              onChangeText={setAnswer}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, submitAnswer.isPending && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitAnswer.isPending || !answer.trim()}
            >
              {submitAnswer.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>Submit Answer</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.feedbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.ratingRow}>
                <StarRating rating={feedback.rating} size={20} />
                <Text style={[styles.ratingNumSmall, { color: colors.primary }]}>{feedback.rating}/5</Text>
              </View>
              <Text style={[styles.fbText, { color: colors.foreground }]}>{feedback.feedback}</Text>
              {feedback.suggestions.length > 0 && (
                <>
                  <Text style={[styles.fbSubtitle, { color: colors.foreground }]}>Suggestions</Text>
                  {feedback.suggestions.map((s, i) => (
                    <View key={i} style={styles.suggRow}>
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.suggText, { color: colors.mutedForeground }]}>{s}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {currentQ.userAnswer && (
              <TouchableOpacity
                style={[styles.modelBtn, { borderColor: colors.border }]}
                onPress={() => setShowModel(!showModel)}
              >
                <Ionicons name={showModel ? "eye-off-outline" : "eye-outline"} size={16} color={colors.mutedForeground} />
                <Text style={[styles.modelBtnText, { color: colors.mutedForeground }]}>{showModel ? "Hide" : "Show"} Model Answer</Text>
              </TouchableOpacity>
            )}

            {showModel && currentQ.userAnswer && (
              <View style={[styles.modelBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.modelTitle, { color: colors.foreground }]}>Model Answer</Text>
                <Text style={[styles.modelText, { color: colors.mutedForeground }]}>
                  Great answer structure: Start with a clear statement, provide a specific example, describe the impact/result, and connect it to the role requirements. Keep it concise (2-3 minutes when spoken).
                </Text>
              </View>
            )}

            {currentIdx < questions.length - 1 ? (
              <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={handleNext}>
                <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Next Question</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: "#22C55E" }]}
                onPress={handleComplete}
                disabled={completeSession.isPending}
              >
                {completeSession.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trophy-outline" size={16} color="#fff" />
                    <Text style={[styles.nextBtnText, { color: "#fff" }]}>Complete Interview</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  progressBar: { height: 4 },
  progressFill: { height: 4 },
  progressText: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  qCounter: { fontSize: 13, fontFamily: "Inter_500Medium" },
  diffBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  diffText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  questionBox: { borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 20 },
  questionText: { fontSize: 17, fontFamily: "Inter_600SemiBold", lineHeight: 24 },
  answerLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  answerInput: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 140, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 14 },
  submitBtn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  feedbackCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginBottom: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingNumSmall: { fontSize: 14, fontFamily: "Inter_700Bold" },
  fbText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fbSubtitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  suggRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 7 },
  suggText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modelBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  modelBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  modelBox: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  modelTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 6 },
  modelText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  nextBtn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  completedHero: { alignItems: "center", gap: 10, marginBottom: 32 },
  completedIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  completedTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  completedRole: { fontSize: 15, fontFamily: "Inter_400Regular" },
  ratingLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
  ratingNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginBottom: 10 },
  qNum: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  qText: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  answerText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  doneBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  doneBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
