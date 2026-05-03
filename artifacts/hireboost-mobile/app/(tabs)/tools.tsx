import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const TOOLS = [
  {
    title: "JD Interview Prep",
    description: "Paste a job description and get tailored questions with model answers.",
    icon: "briefcase-outline" as const,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    route: "/jd-prep",
  },
  {
    title: "LinkedIn Generator",
    description: "Generate viral LinkedIn posts from your achievements and experiences.",
    icon: "logo-linkedin" as const,
    color: "#0A66C2",
    bg: "#EFF6FF",
    route: "/linkedin",
  },
  {
    title: "Salary Negotiation",
    description: "Get AI counter-offers, negotiation scripts, and market insights.",
    icon: "cash-outline" as const,
    color: "#F59E0B",
    bg: "#FFFBEB",
    route: "/salary",
  },
];

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + webTop + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 100, gap: 14 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>AI Tools</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Supercharge your job search with AI-powered tools.</Text>

      {TOOLS.map((tool) => (
        <TouchableOpacity
          key={tool.title}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push(tool.route as never)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: tool.bg }]}>
            <Ionicons name={tool.icon} size={28} color={tool.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{tool.title}</Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{tool.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      ))}

      <View style={[styles.promoCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
        <Ionicons name="flash" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.promoTitle, { color: colors.foreground }]}>Resume Analyzer</Text>
          <Text style={[styles.promoDesc, { color: colors.mutedForeground }]}>Get your ATS score and fix your resume with AI.</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/resume")}>
          <Text style={[styles.promoLink, { color: colors.primary }]}>Open</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 3 },
  promoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  promoTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  promoDesc: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  promoLink: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
