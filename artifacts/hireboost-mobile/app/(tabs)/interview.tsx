import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCreateInterviewSession,
  useListInterviewSessions,
} from "@workspace/api-client-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { StarRating } from "@/components/StarRating";
import { useColors } from "@/hooks/useColors";

const JOB_ROLES = [
  "Software Engineer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
  "Data Scientist", "Machine Learning Engineer", "Product Manager", "UX Designer",
  "DevOps Engineer", "Data Analyst", "Marketing Manager", "Sales Executive",
  "Business Analyst", "HR Manager", "Financial Analyst",
];

const DIFFICULTIES = [
  { label: "Easy", value: "easy", color: "#22C55E" },
  { label: "Medium", value: "medium", color: "#F59E0B" },
  { label: "Hard", value: "hard", color: "#EF4444" },
];

const COUNTS = [5, 8, 10, 15];

export default function InterviewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [questionCount, setQuestionCount] = useState(5);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const { data: sessions, isLoading, refetch } = useListInterviewSessions({});
  const createSession = useCreateInterviewSession();

  const handleCreate = async () => {
    try {
      const session = await createSession.mutateAsync({
        data: { jobRole: selectedRole, difficulty, questionCount },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNewModal(false);
      router.push(`/interview/${session.id}` as never);
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const webTop = Platform.OS === "web" ? 67 : 0;

  const diffColor = DIFFICULTIES.find((d) => d.value === difficulty)?.color ?? "#F59E0B";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LoadingOverlay visible={createSession.isPending} message="Creating interview..." />

      <View style={[styles.header, { paddingTop: insets.top + webTop, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Mock Interviews</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNewModal(true)}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
          <Text style={[styles.newBtnText, { color: colors.primaryForeground }]}>New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !sessions || sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mic-outline" size={56} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sessions yet</Text>
          <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>Start your first mock interview to practice and get AI feedback.</Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewModal(true)}
          >
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Start Interview</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
          refreshing={isLoading}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/interview/${item.id}` as never)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={[styles.roleBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name="mic-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardRole, { color: colors.foreground }]} numberOfLines={1}>{item.jobRole}</Text>
                  <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: item.status === "completed" ? "#DCFCE7" : "#EFF6FF" }]}>
                  <Text style={[styles.statusText, { color: item.status === "completed" ? "#16A34A" : "#3B82F6" }]}>
                    {item.status === "completed" ? "Done" : "Active"}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  {item.answeredQuestions}/{item.totalQuestions} questions · {item.difficulty}
                </Text>
                {item.averageRating != null && (
                  <StarRating rating={item.averageRating} size={14} />
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showNewModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNewModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Interview</Text>
            <TouchableOpacity onPress={() => setShowNewModal(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Job Role</Text>
            <TouchableOpacity
              style={[styles.picker, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => setShowRolePicker(true)}
            >
              <Text style={[styles.pickerText, { color: colors.foreground }]}>{selectedRole}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Difficulty</Text>
            <View style={styles.optionRow}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.optionBtn, { borderColor: difficulty === d.value ? d.color : colors.border, backgroundColor: difficulty === d.value ? d.color + "20" : colors.muted }]}
                  onPress={() => setDifficulty(d.value as "easy" | "medium" | "hard")}
                >
                  <Text style={[styles.optionText, { color: difficulty === d.value ? d.color : colors.mutedForeground }]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Questions</Text>
            <View style={styles.optionRow}>
              {COUNTS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.optionBtn, { borderColor: questionCount === c ? colors.primary : colors.border, backgroundColor: questionCount === c ? colors.primary + "20" : colors.muted }]}
                  onPress={() => setQuestionCount(c)}
                >
                  <Text style={[styles.optionText, { color: questionCount === c ? colors.primary : colors.mutedForeground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreate}
              disabled={createSession.isPending}
            >
              <Ionicons name="flash-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Start Interview</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Modal visible={showRolePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRolePicker(false)}>
          <View style={[styles.modal, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Role</Text>
              <TouchableOpacity onPress={() => setShowRolePicker(false)}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={JOB_ROLES}
              keyExtractor={(r) => r}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.roleItem, { borderBottomColor: colors.border, backgroundColor: selectedRole === item ? colors.primary + "15" : "transparent" }]}
                  onPress={() => { setSelectedRole(item); setShowRolePicker(false); }}
                >
                  <Text style={[styles.roleItemText, { color: selectedRole === item ? colors.primary : colors.foreground }]}>{item}</Text>
                  {selectedRole === item && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", paddingTop: 16 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptyMsg: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  roleBadge: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardRole: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 16, gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  picker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48 },
  pickerText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  optionRow: { flexDirection: "row", gap: 8 },
  optionBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  optionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  createBtn: { height: 52, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  roleItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  roleItemText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
