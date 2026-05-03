import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
  color?: string;
}

export function StarRating({ rating, max = 5, size = 16, color = "#F59E0B" }: StarRatingProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color={i < Math.round(rating) ? color : "#D4D4D8"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
  },
});
