import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useGetDashboardStats,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  bgColor: string;
}

function StatCard({ label, value, icon, iconColor, bgColor }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value ?? "—"}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const TOOLS = [
  { label: "Resume", icon: "document-text-outline" as const, route: "/(tabs)/resume", color: "#A3CC00" },
  { label: "Interview", icon: "mic-outline" as const, route: "/(tabs)/interview", color: "#3B82F6" },
  { label: "JD Prep", icon: "briefcase-outline" as const, route: "/jd-prep", color: "#8B5CF6" },
  { label: "LinkedIn", icon: "logo-linkedin" as const, route: "/linkedin", color: "#0A66C2" },
  { label: "Salary", icon: "cash-outline" as const, route: "/salary", color: "#F59E0B" },
];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats({});
  const { data: activity, isLoading: actLoading, refetch: refetchActivity } = useGetRecentActivity({});

  const isLoading = statsLoading || actLoading;
  const onRefresh = () => { refetchStats(); refetchActivity(); };

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + webTop + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good day,</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? "there"}</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
            {(user?.name ?? "U").charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      {statsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="Latest ATS Score" value={stats?.latestResumeScore ?? "—"} icon="speedometer-outline" iconColor="#22C55E" bgColor="#DCFCE7" />
          <StatCard label="Resumes Analyzed" value={stats?.totalResumesAnalyzed ?? 0} icon="document-text-outline" iconColor="#A3CC00" bgColor="#F0FDF4" />
          <StatCard label="Interviews Done" value={stats?.completedInterviews ?? 0} icon="mic-outline" iconColor="#3B82F6" bgColor="#EFF6FF" />
          <StatCard label="Avg Rating" value={stats?.averageInterviewRating ? `${stats.averageInterviewRating.toFixed(1)}/5` : "—"} icon="star-outline" iconColor="#F59E0B" bgColor="#FFFBEB" />
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
      <View style={styles.toolsRow}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.label}
            style={[styles.toolBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(tool.route as never)}
            activeOpacity={0.75}
          >
            <View style={[styles.toolIcon, { backgroundColor: tool.color + "20" }]}>
              <Ionicons name={tool.icon} size={22} color={tool.color} />
            </View>
            <Text style={[styles.toolLabel, { color: colors.foreground }]}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Activity</Text>
      {actLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !activity || activity.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.muted }]}>
          <Feather name="activity" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activity yet. Start by analyzing your resume!</Text>
        </View>
      ) : (
        activity.map((item) => (
          <View key={item.id} style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.actIcon, { backgroundColor: item.type === "resume_analysis" ? "#F0FDF4" : "#EFF6FF" }]}>
              <Ionicons
                name={item.type === "resume_analysis" ? "document-text-outline" : "mic-outline"}
                size={18}
                color={item.type === "resume_analysis" ? "#22C55E" : "#3B82F6"}
              />
            </View>
            <View style={styles.actContent}>
              <Text style={[styles.actTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.actSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>{item.subtitle}</Text>
            </View>
            {item.score != null && (
              <Text style={[styles.actScore, { color: colors.primary }]}>{item.score}</Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  statCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  toolsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  toolBtn: {
    width: "30%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  toolIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  toolLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptyBox: { borderRadius: 14, padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  actIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actContent: { flex: 1 },
  actTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  actSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actScore: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
