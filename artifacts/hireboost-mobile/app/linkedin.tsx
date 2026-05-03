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
import { useLinkedInGenerate, useLinkedInMakeViral } from "@/hooks/useApi";

const TONES = [
  { label: "Professional", value: "professional", icon: "briefcase-outline" as const },
  { label: "Storytelling", value: "storytelling", icon: "book-outline" as const },
  { label: "Motivational", value: "motivational", icon: "flash-outline" as const },
];

interface Post { hook: string; body: string; hashtags: string[] }

export default function LinkedInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [post, setPost] = useState<Post | null>(null);

  const generate = useLinkedInGenerate();
  const makeViral = useLinkedInMakeViral();

  const handleGenerate = async () => {
    if (!topic.trim()) { Alert.alert("Missing Topic", "Describe your achievement or topic."); return; }
    try {
      const data = await generate.mutateAsync({ topic: topic.trim(), tone });
      setPost(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Generation failed");
    }
  };

  const handleMakeViral = async () => {
    if (!post) return;
    const full = `${post.hook}\n\n${post.body}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;
    try {
      const data = await makeViral.mutateAsync({ post: full });
      setPost(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to make viral");
    }
  };

  const handleCopy = () => {
    if (!post) return;
    const full = `${post.hook}\n\n${post.body}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;
    Clipboard.setStringAsync(full);
    Alert.alert("Copied!", "Post copied to clipboard.");
  };

  const isLoading = generate.isPending || makeViral.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "LinkedIn Generator" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          Turn your achievements into viral LinkedIn posts with AI.
        </Text>

        <TextInput
          style={[styles.textArea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Describe your achievement, career milestone, or topic..."
          placeholderTextColor={colors.mutedForeground}
          value={topic}
          onChangeText={setTopic}
          multiline
          textAlignVertical="top"
        />

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Tone</Text>
        <View style={styles.toneRow}>
          {TONES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.toneBtn,
                {
                  borderColor: tone === t.value ? colors.primary : colors.border,
                  backgroundColor: tone === t.value ? colors.primary + "20" : colors.muted,
                },
              ]}
              onPress={() => setTone(t.value)}
            >
              <Ionicons name={t.icon} size={18} color={tone === t.value ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.toneBtnText, { color: tone === t.value ? colors.primary : colors.mutedForeground }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: "#0A66C2" }, isLoading && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={isLoading}
        >
          {generate.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-linkedin" size={18} color="#fff" />
              <Text style={[styles.btnText, { color: "#fff" }]}>Generate Post</Text>
            </>
          )}
        </TouchableOpacity>

        {post && (
          <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.hook, { color: colors.foreground }]}>{post.hook}</Text>
            <Text style={[styles.body, { color: colors.foreground }]}>{post.body}</Text>
            <View style={styles.hashRow}>
              {post.hashtags.map((h, i) => (
                <Text key={i} style={[styles.hash, { color: "#0A66C2" }]}>#{h}</Text>
              ))}
            </View>

            <View style={[styles.postActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={styles.postAction} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={18} color={colors.mutedForeground} />
                <Text style={[styles.postActionText, { color: colors.mutedForeground }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postAction, styles.viralBtn, { backgroundColor: colors.primary }]}
                onPress={handleMakeViral}
                disabled={makeViral.isPending}
              >
                {makeViral.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.postActionText, { color: colors.primaryForeground }]}>Make Viral</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textArea: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 120, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  toneRow: { flexDirection: "row", gap: 8 },
  toneBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center", gap: 4 },
  toneBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  btn: { height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  postCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  hook: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 22, padding: 16, paddingBottom: 4 },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, paddingHorizontal: 16, paddingBottom: 10 },
  hashRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16, paddingBottom: 14 },
  hash: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  postActions: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center", gap: 8, padding: 12 },
  postAction: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  viralBtn: { flex: 1, justifyContent: "center" },
  postActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
