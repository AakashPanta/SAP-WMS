import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function ActionButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = "primary",
  size = "md",
}: ActionButtonProps) {
  const colors = useColors();

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const bgColor =
    variant === "primary"
      ? colors.primary
      : variant === "secondary"
      ? colors.secondary
      : "transparent";

  const textColor =
    variant === "primary"
      ? colors.primaryForeground
      : variant === "secondary"
      ? colors.secondaryForeground
      : colors.primary;

  const borderColor =
    variant === "ghost" ? colors.border : "transparent";

  const height = size === "lg" ? 56 : size === "sm" ? 40 : 50;
  const fontSize = size === "lg" ? 16 : size === "sm" ? 13 : 15;

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.78}
      disabled={isDisabled}
      style={[
        styles.btn,
        {
          backgroundColor: isDisabled
            ? variant === "primary"
              ? colors.muted
              : bgColor
            : bgColor,
          borderColor,
          borderWidth: variant === "ghost" ? 1.5 : 0,
          height,
          opacity: isDisabled ? 0.65 : 1,
          shadowColor: variant === "primary" ? colors.primary : "transparent",
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
          size="small"
          style={{ marginRight: 6 }}
        />
      ) : icon ? (
        <View style={styles.iconWrap}>
          <Feather name={icon} size={18} color={isDisabled ? colors.mutedForeground : textColor} />
        </View>
      ) : null}
      <Text
        style={[
          styles.label,
          {
            fontSize,
            color: isDisabled
              ? variant === "primary"
                ? colors.mutedForeground
                : textColor
              : textColor,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  iconWrap: {
    marginRight: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
