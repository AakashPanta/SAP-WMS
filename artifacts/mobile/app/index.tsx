import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSap } from "@/context/SapContext";

export default function SplashRouter() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authState } = useSap();

  useEffect(() => {
    if (authState === "authenticated") {
      router.replace("/warehouse");
    } else if (authState === "unauthenticated") {
      router.replace("/login");
    }
  }, [authState]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.headerBg, paddingTop: topPad },
      ]}
    >
      <View style={styles.center}>
        <View
          style={[
            styles.logoBox,
            { backgroundColor: "rgba(255,255,255,0.15)" },
          ]}
        >
          <Feather name="package" size={38} color="#ffffff" />
        </View>
        <Text style={styles.title}>SAP EWM</Text>
        <Text style={styles.subtitle}>Extended Warehouse Management</Text>

        <View style={styles.loadingRow}>
          <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
          <Text style={styles.loadingText}>
            {authState === "initializing" ? "Restoring session…" : "Redirecting…"}
          </Text>
        </View>
      </View>

      <Text style={styles.version}>S/4HANA Cloud · my303451</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  version: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.3,
  },
});
