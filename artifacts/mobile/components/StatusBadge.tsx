import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StatusBadgeProps {
  status: "connected" | "disconnected" | "loading";
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = useColors();

  const config = {
    connected: {
      color: colors.success,
      icon: "wifi" as keyof typeof Feather.glyphMap,
      text: label ?? "Connected",
      bg: "#dcfce7",
    },
    disconnected: {
      color: colors.destructive,
      icon: "wifi-off" as keyof typeof Feather.glyphMap,
      text: label ?? "Disconnected",
      bg: "#fee2e2",
    },
    loading: {
      color: colors.warning,
      icon: "clock" as keyof typeof Feather.glyphMap,
      text: label ?? "Connecting...",
      bg: "#fef3c7",
    },
  };

  const cfg = config[status];

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
