import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: stats } = useGetDashboardStats({});
  const webTop = Platform.OS === "web" ? 67 : 0;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const infoRows = [
    { icon: "person-outline" as const, label: "Name", value: user?.name ?? "—" },
    { icon: "mail-outline" as const, label: "Email", value: user?.email ?? "—" },
    { icon: "calendar-outline" as const, label: "Member Since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—" },
  ];

  const statRows = [
    { label: "Resumes Analyzed", value: stats?.totalResumesAnalyzed ?? 0, icon: "document-text-outline" as const, color: "#A3CC00" },
    { label: "Interviews Completed", value: stats?.completedInterviews ?? 0, icon: "mic-outline" as const, color: "#3B82F6" },
    { label: "Avg. Interview Rating", value: stats?.averageInterviewRating ? `${stats.averageInterviewRating.toFixed(1)}/5` : "—", icon: "star-outline" as const, color: "#F59E0B" },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + webTop + 16, paddingBottom: insets.bottom + 100, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.avatarSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>{initials}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name ?? "User"}</Text>
        <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user?.email ?? ""}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {infoRows.map((row, i) => (
          <View key={row.label}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.muted }]}>
                <Ionicons name={row.icon} size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>{row.value}</Text>
              </View>
            </View>
            {i < infoRows.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Stats</Text>
      <View style={styles.statsGrid}>
        {statRows.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={stat.icon} size={22} color={stat.color} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.destructive }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatarSection: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 10 },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 24 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  infoIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 6 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
