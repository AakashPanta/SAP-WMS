import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function InfoRow({ label, value, mono }: InfoRowProps) {
  const colors = useColors();

  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          {
            color: colors.foreground,
            fontFamily: mono ? "Inter_500Medium" : "Inter_400Regular",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  value: {
    fontSize: 13,
    maxWidth: "60%",
    textAlign: "right",
  },
});
