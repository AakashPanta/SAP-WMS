import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface SectionCardProps {
  title?: string;
  icon?: keyof typeof Feather.glyphMap;
  children: React.ReactNode;
}

export function SectionCard({ title, icon, children }: SectionCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {title ? (
        <View style={[styles.header, { borderBottomColor: colors.divider }]}>
          {icon ? (
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name={icon} size={14} color={colors.primary} />
            </View>
          ) : null}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  content: {
    padding: 18,
    gap: 16,
  },
});
