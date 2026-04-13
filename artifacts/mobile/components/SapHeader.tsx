import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

interface SapHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function SapHeader({
  title,
  subtitle,
  rightElement,
}: SapHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.headerBg,
          paddingTop: topPad + 12,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.logoRow}>
          <View style={[styles.logoBox, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Feather name="package" size={18} color="#ffffff" />
          </View>
          <View style={styles.titleGroup}>
            <Text style={[styles.title, { color: colors.headerText }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.headerSubtext }]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        {rightElement ? <View>{rightElement}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  titleGroup: {
    gap: 1,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.1,
  },
});
