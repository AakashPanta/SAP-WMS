import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useColors } from "@/hooks/useColors";
import { useSap } from "@/context/SapContext";

const SAP_FORGOT_PASSWORD_URL = "https://account.sap.com/forgot-password";

function SapLogo() {
  return (
    <View style={logo.shell}>
      <View style={logo.outerRing}>
        <View style={logo.badge}>
          <Text style={logo.text}>SAP</Text>
        </View>
      </View>
      <View style={logo.wordmarkRow}>
        <Text style={logo.wordmarkA}>S/4HANA</Text>
        <Text style={logo.wordmarkB}> Cloud</Text>
      </View>
    </View>
  );
}

const logo = StyleSheet.create({
  shell: { alignItems: "center", gap: 10 },
  outerRing: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "rgba(0, 80, 170, 0.08)",
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#0050aa",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0050aa",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 10,
  },
  text: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: 2.5,
  },
  wordmarkRow: { flexDirection: "row", alignItems: "baseline" },
  wordmarkA: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#0050aa",
    letterSpacing: 0.4,
  },
  wordmarkB: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#556070",
    letterSpacing: 0.2,
  },
});

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    login,
    isLoading,
    error,
    errorCode,
    clearError,
    sapConfig,
    savedWarehouseConfig,
  } = useSap();

  const [step, setStep] = useState<"credentials" | "warehouse">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [client, setClient] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showClientField, setShowClientField] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [warehouseNo, setWarehouseNo] = useState(
    savedWarehouseConfig?.warehouseNo ?? "",
  );
  const [resource, setResource] = useState(
    savedWarehouseConfig?.resource ?? "",
  );
  const [presDevice, setPresDevice] = useState(
    savedWarehouseConfig?.presDevice ?? "",
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const warehouseNoRef = useRef<TextInput>(null);
  const resourceRef = useRef<TextInput>(null);
  const presDeviceRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (savedWarehouseConfig) {
      setWarehouseNo(savedWarehouseConfig.warehouseNo);
      setResource(savedWarehouseConfig.resource);
      setPresDevice(savedWarehouseConfig.presDevice);
    }
  }, [savedWarehouseConfig]);

  useEffect(() => {
    if (error) {
      const code = errorCode ?? "";
      let title = "Sign-in Failed";
      let detail = error;
      if (code === "AUTH_FAILED") {
        title = "Incorrect Credentials";
        detail = "The user name or password is incorrect. Please try again.";
      } else if (code === "SSO_REQUIRED") {
        title = "SSO Login Required";
        detail =
          "This SAP tenant is configured for Single Sign-On (SSO) and does not support standard username/password login through the app. Contact your SAP administrator to enable ITS form-based authentication, or use a WebView-based SSO flow.";
      } else if (code === "TIMEOUT") {
        title = "Connection Timeout";
        detail =
          "The SAP server took too long to respond. Check your network and retry.";
      } else if (code === "NETWORK_ERROR") {
        title = "Network Error";
        detail = `Could not reach the SAP server. Check your connection.\n\n${error}`;
      } else if (code === "SAP_ERROR") {
        title = "SAP Error";
      }
      Alert.alert(title, detail, [{ text: "OK", onPress: clearError }]);
    }
  }, [error]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const clearErr = (key: string) =>
    setFieldErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });

  const animateStep = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(slideAnim, {
            toValue: 12,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  };

  const handleContinue = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Required";
    if (!password) errs.password = "Required";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setStep("warehouse");
    animateStep();
    setTimeout(() => warehouseNoRef.current?.focus(), 400);
  };

  const handleLogin = async () => {
    const errs: Record<string, string> = {};
    if (!warehouseNo.trim()) errs.warehouseNo = "Required";
    if (!resource.trim()) errs.resource = "Required";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }

    const success = await login({
      username: username.trim(),
      password,
      client: client.trim() || sapConfig?.defaultClient || "100",
      warehouseNo: warehouseNo.trim(),
      resource: resource.trim(),
      presDevice: presDevice.trim(),
      rememberMe: keepSignedIn,
    });
    if (success) router.replace("/warehouse");
  };

  const handleForgotPassword = () => {
    Linking.openURL(SAP_FORGOT_PASSWORD_URL).catch(() =>
      Alert.alert(
        "Cannot open link",
        `Visit ${SAP_FORGOT_PASSWORD_URL} to reset your password.`,
      ),
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: "#ffffff" }]}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.topBar,
          { paddingTop: topPad + 14, backgroundColor: "#ffffff" },
        ]}
      >
        {step === "warehouse" ? (
          <TouchableOpacity
            onPress={() => {
              setStep("credentials");
              animateStep();
            }}
            style={styles.navBtn}
            disabled={isLoading}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        ) : (
          <View style={styles.navBtn} />
        )}
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 36 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.form,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoSection}>
            <SapLogo />
          </View>

          {step === "credentials" ? (
            <>
              <View style={styles.header}>
                <Text style={[styles.heading, { color: "#1a2332" }]}>
                  Welcome
                </Text>
                <Text style={[styles.subheading, { color: "#556070" }]}>
                  Sign in with your SAP account to continue
                </Text>
              </View>

              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: "#2d3a47" }]}>
                    Email or User Name
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor: fieldErrors.username
                          ? colors.destructive
                          : "#c8d0db",
                        backgroundColor: "#f6f8fb",
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        { color: "#1a2332" },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : null,
                      ]}
                      placeholder="Enter email or user name"
                      placeholderTextColor="#9aa3ae"
                      value={username}
                      onChangeText={(t) => {
                        setUsername(t);
                        clearErr("username");
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      returnKeyType="next"
                    />
                  </View>
                  {fieldErrors.username ? (
                    <Text
                      style={[
                        styles.fieldErr,
                        { color: colors.destructive },
                      ]}
                    >
                      {fieldErrors.username}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: "#2d3a47" }]}>
                      Password
                    </Text>
                    <TouchableOpacity onPress={handleForgotPassword}>
                      <Text style={[styles.forgotLink, { color: "#0050aa" }]}>
                        Forgot password?
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor: fieldErrors.password
                          ? colors.destructive
                          : "#c8d0db",
                        backgroundColor: "#f6f8fb",
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        { color: "#1a2332", flex: 1 },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : null,
                      ]}
                      placeholder="Enter password"
                      placeholderTextColor="#9aa3ae"
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        clearErr("password");
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleContinue}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.eyeBtn}
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={17}
                        color="#9aa3ae"
                      />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? (
                    <Text
                      style={[
                        styles.fieldErr,
                        { color: colors.destructive },
                      ]}
                    >
                      {fieldErrors.password}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => setKeepSignedIn((v) => !v)}
                  activeOpacity={0.7}
                  style={styles.keepRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: keepSignedIn
                          ? "#0050aa"
                          : "transparent",
                        borderColor: keepSignedIn ? "#0050aa" : "#b0bac5",
                      },
                    ]}
                  >
                    {keepSignedIn ? (
                      <Feather name="check" size={12} color="#fff" />
                    ) : null}
                  </View>
                  <Text style={[styles.keepLabel, { color: "#2d3a47" }]}>
                    Keep me signed in
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowClientField((v) => !v)}
                  style={styles.advancedRow}
                >
                  <Text style={[styles.advancedLabel, { color: "#0050aa" }]}>
                    {showClientField ? "Hide" : "Show"} advanced options
                  </Text>
                  <Feather
                    name={showClientField ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#0050aa"
                  />
                </TouchableOpacity>

                {showClientField ? (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: "#2d3a47" }]}>
                      SAP Client
                    </Text>
                    <View
                      style={[
                        styles.inputWrap,
                        {
                          borderColor: "#c8d0db",
                          backgroundColor: "#f6f8fb",
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.input,
                          { color: "#1a2332" },
                          Platform.OS === "web"
                            ? ({ outlineStyle: "none" } as any)
                            : null,
                        ]}
                        placeholder={sapConfig?.defaultClient ?? "100"}
                        placeholderTextColor="#9aa3ae"
                        value={client}
                        onChangeText={setClient}
                        keyboardType="number-pad"
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: "#0050aa" }]}
                onPress={handleContinue}
                activeOpacity={0.86}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View
                  style={[styles.dividerLine, { backgroundColor: "#dde2e8" }]}
                />
                <Text style={[styles.dividerText, { color: "#9aa3ae" }]}>
                  Secure access
                </Text>
                <View
                  style={[styles.dividerLine, { backgroundColor: "#dde2e8" }]}
                />
              </View>

              <View style={styles.secureRow}>
                <Feather name="shield" size={14} color="#9aa3ae" />
                <Text style={[styles.secureText, { color: "#9aa3ae" }]}>
                  Your credentials authenticate directly with SAP and are
                  stored securely on this device
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={[styles.heading, { color: "#1a2332" }]}>
                  Warehouse Setup
                </Text>
                <Text style={[styles.subheading, { color: "#556070" }]}>
                  Configure your warehouse session. These settings are saved
                  for future sign-ins.
                </Text>
              </View>

              <View
                style={[
                  styles.credPill,
                  { backgroundColor: "#f0f4fa", borderColor: "#d0d8e4" },
                ]}
              >
                <Feather name="user-check" size={14} color="#0050aa" />
                <Text style={[styles.credPillText, { color: "#556070" }]}>
                  Signed in as{" "}
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      color: "#1a2332",
                    }}
                  >
                    {username}
                  </Text>
                </Text>
              </View>

              <View style={styles.fields}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: "#2d3a47" }]}>
                    Warehouse No.{" "}
                    <Text style={{ color: colors.destructive }}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor: fieldErrors.warehouseNo
                          ? colors.destructive
                          : "#c8d0db",
                        backgroundColor: "#f6f8fb",
                      },
                    ]}
                  >
                    <TextInput
                      ref={warehouseNoRef}
                      style={[
                        styles.input,
                        {
                          color: "#1a2332",
                          fontFamily: "Inter_600SemiBold",
                          letterSpacing: 1,
                        },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : null,
                      ]}
                      value={warehouseNo}
                      onChangeText={(t) => {
                        setWarehouseNo(t.toUpperCase());
                        clearErr("warehouseNo");
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={10}
                      returnKeyType="next"
                      onSubmitEditing={() => resourceRef.current?.focus()}
                    />
                  </View>
                  {fieldErrors.warehouseNo ? (
                    <Text
                      style={[
                        styles.fieldErr,
                        { color: colors.destructive },
                      ]}
                    >
                      {fieldErrors.warehouseNo}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: "#2d3a47" }]}>
                    Resource{" "}
                    <Text style={{ color: colors.destructive }}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        borderColor: fieldErrors.resource
                          ? colors.destructive
                          : "#c8d0db",
                        backgroundColor: "#f6f8fb",
                      },
                    ]}
                  >
                    <TextInput
                      ref={resourceRef}
                      style={[
                        styles.input,
                        {
                          color: "#1a2332",
                          fontFamily: "Inter_600SemiBold",
                          letterSpacing: 1,
                        },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : null,
                      ]}
                      value={resource}
                      onChangeText={(t) => {
                        setResource(t.toUpperCase());
                        clearErr("resource");
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={20}
                      returnKeyType="next"
                      onSubmitEditing={() => {
                        if (!presDevice) setPresDevice("SE01");
                        presDeviceRef.current?.focus();
                      }}
                    />
                  </View>
                  {fieldErrors.resource ? (
                    <Text
                      style={[
                        styles.fieldErr,
                        { color: colors.destructive },
                      ]}
                    >
                      {fieldErrors.resource}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: "#2d3a47" }]}>
                    Dflt Pres. Dev.
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      { borderColor: "#c8d0db", backgroundColor: "#f6f8fb" },
                    ]}
                  >
                    <TextInput
                      ref={presDeviceRef}
                      style={[
                        styles.input,
                        {
                          color: "#1a2332",
                          fontFamily: "Inter_600SemiBold",
                          letterSpacing: 1,
                        },
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : null,
                      ]}
                      value={presDevice}
                      onChangeText={(t) => setPresDevice(t.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={20}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  {
                    backgroundColor: isLoading ? "#b0bfc8" : "#0050aa",
                    flexDirection: "row",
                    gap: 10,
                  },
                ]}
                onPress={handleLogin}
                activeOpacity={0.86}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="log-in" size={17} color="#fff" />
                )}
                <Text style={styles.primaryBtnText}>
                  {isLoading ? "Connecting to SAP…" : "Connect to SAP"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad + 14 }]}>
        <View style={styles.footerLogoRow}>
          <View style={[styles.footerSapBadge, { backgroundColor: "#0050aa" }]}>
            <Text style={styles.footerSapText}>SAP</Text>
          </View>
          <Text style={[styles.footerInfo, { color: "#9aa3ae" }]}>
            {sapConfig?.tenant ?? "my419914.s4hana.cloud.sap"}
          </Text>
          {sapConfig?.ping ? (
            <View
              style={[
                styles.pingPill,
                {
                  backgroundColor: sapConfig.ping.requiresSSO
                    ? "#fff7ed"
                    : sapConfig.ping.reachable
                      ? "#f0fdf4"
                      : "#fef2f2",
                  borderColor: sapConfig.ping.requiresSSO
                    ? "#fed7aa"
                    : sapConfig.ping.reachable
                      ? "#bbf7d0"
                      : "#fecaca",
                },
              ]}
            >
              <View
                style={[
                  styles.pingDot,
                  {
                    backgroundColor: sapConfig.ping.requiresSSO
                      ? "#f97316"
                      : sapConfig.ping.reachable
                        ? "#22c55e"
                        : "#ef4444",
                  },
                ]}
              />
              <Text
                style={[
                  styles.pingText,
                  {
                    color: sapConfig.ping.requiresSSO
                      ? "#c2410c"
                      : sapConfig.ping.reachable
                        ? "#15803d"
                        : "#b91c1c",
                  },
                ]}
              >
                {sapConfig.ping.requiresSSO
                  ? "SSO only"
                  : sapConfig.ping.reachable
                    ? `Live · ${sapConfig.ping.durationMs}ms`
                    : "Unreachable"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 4,
  },
  form: { gap: 24 },

  logoSection: {
    alignItems: "center",
    paddingVertical: 8,
  },

  header: { gap: 6 },
  heading: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.1,
  },
  subheading: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },

  credPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  credPillText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },

  fields: { gap: 16 },
  fieldGroup: { gap: 6 },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  forgotLink: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    height: "100%",
  },
  eyeBtn: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
  fieldErr: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  keepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  keepLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },

  advancedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  advancedLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },

  primaryBtn: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    letterSpacing: 0.15,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.4,
  },

  secureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  secureText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    flex: 1,
  },

  footer: {
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#edf0f4",
    paddingHorizontal: 20,
  },
  footerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  footerSapBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footerSapText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.8,
  },
  footerInfo: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  pingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pingText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
