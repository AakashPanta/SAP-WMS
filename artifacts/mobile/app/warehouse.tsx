import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSap } from "@/context/SapContext";

type ConnStatus = "connected" | "disconnected" | "checking";

export default function WarehouseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    session,
    logout,
    refreshStatus,
    submitAction,
    saveWarehouseConfig,
    savedWarehouseConfig,
  } = useSap();

  const [warehouseNo, setWarehouseNo] = useState(
    session?.warehouseNo ?? savedWarehouseConfig?.warehouseNo ?? "",
  );
  const [resource, setResource] = useState(
    session?.resource ?? savedWarehouseConfig?.resource ?? "",
  );
  const [presDevice, setPresDevice] = useState(
    session?.presDevice ?? savedWarehouseConfig?.presDevice ?? "",
  );

  const [connStatus, setConnStatus] = useState<ConnStatus>("checking");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastMessages, setLastMessages] = useState<string[]>(
    session?.sapMessages ?? [],
  );
  const [sessionTimer, setSessionTimer] = useState("");
  const [editMode, setEditMode] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    void checkConn();
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const secs = Math.round(
        (Date.now() - new Date(session.loginAt).getTime()) / 1000,
      );
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setSessionTimer(m > 0 ? `${m}m ${s}s` : `${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (connStatus === "connected") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [connStatus]);

  const checkConn = async () => {
    setConnStatus("checking");
    const ok = await refreshStatus();
    setConnStatus(ok ? "connected" : "disconnected");
  };

  const handleF2 = useCallback(async () => {
    if (connStatus !== "connected") {
      Alert.alert(
        "Not Connected",
        "Please check your SAP connection before executing actions.",
        [{ text: "Retry", onPress: checkConn }, { text: "Cancel", style: "cancel" }],
      );
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    Alert.alert(
      "F2 — Receive Resource",
      `Submit to SAP EWM backend:\n\n• Warehouse: ${warehouseNo}\n• Resource: ${resource}${presDevice ? `\n• Device: ${presDevice}` : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Execute F2",
          style: "default",
          onPress: async () => {
            setActionLoading("F2");
            try {
              const result = await submitAction("F2", {
                LGNUM: warehouseNo,
                RSRC: resource,
                PDEVICE: presDevice,
              });
              if (Platform.OS !== "web") {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }
              setLastMessages(result.sapMessages);
              if (result.sapMessages.length > 0) {
                Alert.alert("SAP Response", result.sapMessages.join("\n"));
              } else {
                Alert.alert("Success", "Action submitted to SAP successfully.");
              }
            } catch (err: any) {
              if (Platform.OS !== "web") {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
              }
              Alert.alert(
                "SAP Error",
                err instanceof Error ? err.message : "Action failed",
                [
                  { text: "OK" },
                  {
                    text: "Re-login",
                    onPress: async () => {
                      await logout();
                      router.replace("/login");
                    },
                  },
                ],
              );
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [warehouseNo, resource, presDevice, connStatus]);

  const handleSaveConfig = async () => {
    await saveWarehouseConfig({ warehouseNo, resource, presDevice });
    setEditMode(false);
    Alert.alert("Saved", "Warehouse configuration saved for future sessions.");
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "This will clear your stored session and credentials. You will need to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ],
    );
  };

  if (!session) {
    router.replace("/login");
    return null;
  }

  const connColor =
    connStatus === "connected"
      ? "#22c55e"
      : connStatus === "checking"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />

      <View
        style={[
          styles.header,
          { backgroundColor: colors.headerBg, paddingTop: topPad + 10 },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: "rgba(255,255,255,0.14)" },
              ]}
            >
              <Feather name="package" size={17} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>SAP EWM</Text>
              <Text style={styles.headerSub}>Warehouse Operations</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={checkConn}
              style={[
                styles.iconBtn,
                { backgroundColor: "rgba(255,255,255,0.1)" },
              ]}
            >
              {connStatus === "checking" ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
              ) : (
                <Feather
                  name="refresh-cw"
                  size={14}
                  color="rgba(255,255,255,0.85)"
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={[
                styles.iconBtn,
                { backgroundColor: "rgba(255,255,255,0.1)" },
              ]}
            >
              <Feather name="log-out" size={14} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.connRow}>
          <View style={styles.connDotWrap}>
            <Animated.View
              style={[
                styles.connDotRing,
                {
                  backgroundColor: connColor + "40",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={[styles.connDot, { backgroundColor: connColor }]} />
          </View>
          <Text style={styles.connText}>
            {connStatus === "connected"
              ? "SAP Connected"
              : connStatus === "checking"
                ? "Checking connection…"
                : "SAP Disconnected"}
          </Text>
          <Text style={styles.userChip}>
            {session.username} · Client {session.client}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {lastMessages.length > 0 ? (
          <View
            style={[
              styles.msgBox,
              { backgroundColor: "#f0f7ff", borderColor: "#93c5fd" },
            ]}
          >
            <View style={styles.msgHeader}>
              <Feather name="message-square" size={14} color={colors.primary} />
              <Text style={[styles.msgTitle, { color: colors.primary }]}>
                SAP Messages
              </Text>
              <TouchableOpacity
                onPress={() => setLastMessages([])}
                style={styles.msgClose}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {lastMessages.map((m, i) => (
              <Text key={i} style={[styles.msgText, { color: colors.foreground }]}>
                {m}
              </Text>
            ))}
          </View>
        ) : null}

        <View
          style={[
            styles.mainCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View
            style={[styles.cardHeader, { borderBottomColor: colors.divider }]}
          >
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              WAREHOUSE SESSION
            </Text>
            <TouchableOpacity
              onPress={() => setEditMode((v) => !v)}
              style={[
                styles.editBtn,
                {
                  backgroundColor: editMode
                    ? colors.primary
                    : colors.secondary,
                },
              ]}
            >
              <Feather
                name={editMode ? "check" : "edit-2"}
                size={13}
                color={editMode ? "#fff" : colors.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <FieldRow
              label="Warehouse No."
              value={warehouseNo}
              editable={editMode}
              onChangeText={(t) => setWarehouseNo(t.toUpperCase())}
              placeholder="RM01"
              colors={colors}
            />
            <FieldRow
              label="Resource"
              value={resource}
              editable={editMode}
              onChangeText={(t) => setResource(t.toUpperCase())}
              placeholder="CS02-LAL"
              colors={colors}
            />
            <FieldRow
              label="Dflt Pres. Dev."
              value={presDevice}
              editable={editMode}
              onChangeText={(t) => setPresDevice(t.toUpperCase())}
              placeholder="SE01"
              colors={colors}
            />

            {editMode ? (
              <TouchableOpacity
                onPress={handleSaveConfig}
                style={[
                  styles.saveBtn,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Feather name="save" size={14} color={colors.primary} />
                <Text style={[styles.saveBtnText, { color: colors.primary }]}>
                  Save configuration
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.f2Wrap, { borderTopColor: colors.divider }]}>
            <TouchableOpacity
              onPress={handleF2}
              disabled={!!actionLoading || connStatus !== "connected"}
              activeOpacity={0.82}
              style={[
                styles.f2Btn,
                {
                  backgroundColor:
                    actionLoading || connStatus !== "connected"
                      ? colors.muted
                      : colors.primary,
                },
              ]}
            >
              {actionLoading === "F2" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.f2Inner}>
                  <View
                    style={[
                      styles.f2KeyBadge,
                      { backgroundColor: "rgba(255,255,255,0.2)" },
                    ]}
                  >
                    <Text style={styles.f2KeyText}>F2</Text>
                  </View>
                  <Text
                    style={[
                      styles.f2Label,
                      {
                        color:
                          connStatus !== "connected"
                            ? colors.mutedForeground
                            : "#fff",
                      },
                    ]}
                  >
                    RcvRe — Receive Resource
                  </Text>
                  <Feather
                    name="arrow-right"
                    size={18}
                    color={connStatus !== "connected" ? colors.mutedForeground : "#fff"}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.secondaryKeys}>
          {[
            { okCode: "F3", label: "Put Away", icon: "arrow-up-circle" as const },
            { okCode: "F4", label: "Pick Order", icon: "shopping-bag" as const },
            { okCode: "F5", label: "Transfer", icon: "git-merge" as const },
            { okCode: "F6", label: "Inventory", icon: "layers" as const },
          ].map((k) => (
            <TouchableOpacity
              key={k.okCode}
              onPress={async () => {
                if (connStatus !== "connected") return;
                if (Platform.OS !== "web") {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                Alert.alert(
                  `${k.okCode} — ${k.label}`,
                  `Execute ${k.label} on the SAP backend?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Execute",
                      onPress: async () => {
                        setActionLoading(k.okCode);
                        try {
                          const r = await submitAction(k.okCode);
                          setLastMessages(r.sapMessages);
                          if (r.sapMessages.length)
                            Alert.alert("SAP Response", r.sapMessages.join("\n"));
                        } catch (e: any) {
                          Alert.alert(
                            "Error",
                            e instanceof Error ? e.message : "Action failed",
                          );
                        } finally {
                          setActionLoading(null);
                        }
                      },
                    },
                  ],
                );
              }}
              disabled={!!actionLoading || connStatus !== "connected"}
              activeOpacity={0.75}
              style={[
                styles.secKey,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: connStatus !== "connected" ? 0.45 : 1,
                },
              ]}
            >
              {actionLoading === k.okCode ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name={k.icon} size={18} color={colors.primary} />
              )}
              <Text style={[styles.secKeyLabel, { color: colors.foreground }]}>
                {k.label}
              </Text>
              <View
                style={[
                  styles.secKeyCode,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text style={[styles.secKeyCodeText, { color: colors.primary }]}>
                  {k.okCode}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={[
            styles.sessionInfo,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.siRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.siLabel, { color: colors.mutedForeground }]}>
              User
            </Text>
            <Text style={[styles.siValue, { color: colors.foreground }]}>
              {session.username}
            </Text>
          </View>
          <View style={[styles.siRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.siLabel, { color: colors.mutedForeground }]}>
              Client
            </Text>
            <Text style={[styles.siValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {session.client}
            </Text>
          </View>
          <View style={[styles.siRow, { borderBottomColor: colors.divider }]}>
            <Text style={[styles.siLabel, { color: colors.mutedForeground }]}>
              Session Active
            </Text>
            <Text style={[styles.siValue, { color: colors.foreground }]}>
              {sessionTimer}
            </Text>
          </View>
          <View style={styles.siRow}>
            <Text style={[styles.siLabel, { color: colors.mutedForeground }]}>
              Connected Since
            </Text>
            <Text style={[styles.siValue, { color: colors.foreground }]}>
              {new Date(session.loginAt).toLocaleTimeString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={[
            styles.signOutBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function FieldRow({
  label,
  value,
  editable,
  onChangeText,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  editable: boolean;
  onChangeText: (t: string) => void;
  placeholder: string;
  colors: any;
}) {
  return (
    <View style={fieldStyles.row}>
      <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      {editable ? (
        <TextInput
          style={[
            fieldStyles.editInput,
            {
              color: colors.foreground,
              borderColor: colors.primary,
              backgroundColor: "#f0f6ff",
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
          {...(Platform.OS === "web"
            ? ({ style: [fieldStyles.editInput, { color: colors.foreground, borderColor: colors.primary, backgroundColor: "#f0f6ff", outlineStyle: "none" } as any] })
            : {})}
        />
      ) : (
        <Text
          style={[
            fieldStyles.value,
            {
              color: value ? colors.foreground : colors.mutedForeground,
              fontFamily: "Inter_700Bold",
            },
          ]}
        >
          {value || "—"}
        </Text>
      )}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  value: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
  editInput: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 100,
    textAlign: "right",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 10,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.58)",
  },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  connRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connDotWrap: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  connDotRing: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.88)",
    flex: 1,
  },
  userChip: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
  scroll: { padding: 18, gap: 16 },
  msgBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  msgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  msgTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  msgClose: { padding: 2 },
  msgText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  mainCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cardIconBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    flex: 1,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    gap: 0,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 8,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  f2Wrap: {
    padding: 14,
    borderTopWidth: 1,
  },
  f2Btn: {
    height: 58,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  f2Inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  f2KeyBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  f2KeyText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  f2Label: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  secondaryKeys: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secKey: {
    width: "47%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  secKeyLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  secKeyCode: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  secKeyCodeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  sessionInfo: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  siRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  siLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  siValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
