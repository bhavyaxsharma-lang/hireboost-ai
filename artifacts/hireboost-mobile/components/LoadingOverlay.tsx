import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const colors = useColors();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.foreground }]}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    minWidth: 180,
  },
  text: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
