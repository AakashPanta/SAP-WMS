import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

const SAP_RFUI_URL =
  "https://my419914.s4hana.cloud.sap/sap/bc/gui/sap/its/ewm_mobgui?~transaction=/scwm/rfui&sap-language=EN#";

const ALLOWED_HOSTS = [
  "my419914.s4hana.cloud.sap",
  "aoayy8srk.accounts.cloud.sap",
];

export default function IndexScreen() {
  const webViewRef = useRef<WebView>(null);

  const [currentUrl, setCurrentUrl] = useState(SAP_RFUI_URL);
  const [title, setTitle] = useState("SAP WMS");
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [errorText, setErrorText] = useState("");

  const allowedHosts = useMemo(() => ALLOWED_HOSTS, []);

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setLoading(navState.loading);

    if (navState.url) {
      setCurrentUrl(navState.url);
    }

    if (navState.title) {
      setTitle(navState.title);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1E3A" />

      <View style={styles.header}>
        <View style={styles.brandWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>SAP</Text>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.appTitle}>SAP WMS</Text>
            <Text style={styles.appSubtitle} numberOfLines={1}>
              {title || currentUrl}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, !canGoBack && styles.actionButtonDisabled]}
            disabled={!canGoBack}
            onPress={() => webViewRef.current?.goBack()}
          >
            <Text style={[styles.actionButtonText, !canGoBack && styles.actionButtonTextDisabled]}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => webViewRef.current?.reload()}
          >
            <Text style={styles.actionButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setErrorText("");
              setCurrentUrl(SAP_RFUI_URL);
              webViewRef.current?.stopLoading();
              setTimeout(() => {
                webViewRef.current?.reload();
              }, 50);
            }}
          >
            <Text style={styles.actionButtonText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#1565C0" />
          <Text style={styles.loadingText}>Opening SAP...</Text>
        </View>
      )}

      {!!errorText && (
        <View style={styles.errorBar}>
          <Text style={styles.errorBarTitle}>Connection error</Text>
          <Text style={styles.errorBarText}>{errorText}</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        mixedContentMode="compatibility"
        originWhitelist={["*"]}
        cacheEnabled
        incognito={false}
        onNavigationStateChange={handleNavigationChange}
        onLoadStart={() => {
          setLoading(true);
          setErrorText("");
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={(event) => {
          setLoading(false);
          setErrorText(event.nativeEvent.description || "Unable to load SAP.");
        }}
        onHttpError={(event) => {
          setLoading(false);
          setErrorText(
            `HTTP ${event.nativeEvent.statusCode}: Unable to load SAP page.`,
          );
        }}
        renderLoading={() => (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#1565C0" />
            <Text style={styles.centerStateText}>Opening SAP...</Text>
          </View>
        )}
        renderError={() => (
          <View style={styles.centerState}>
            <Text style={styles.centerErrorTitle}>Unable to open SAP</Text>
            <Text style={styles.centerErrorText}>
              Check your internet connection and SAP server availability.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setErrorText("");
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        onShouldStartLoadWithRequest={(request) => {
          try {
            const host = new URL(request.url).host;
            return allowedHosts.includes(host);
          } catch {
            return false;
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A1E3A",
  },
  header: {
    backgroundColor: "#0A1E3A",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#17385F",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#1565C0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleWrap: {
    flex: 1,
  },
  appTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  appSubtitle: {
    color: "#BFD0E7",
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#17385F",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  actionButtonTextDisabled: {
    color: "#D7E2F1",
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF3FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  loadingText: {
    color: "#163A63",
    fontSize: 13,
    fontWeight: "500",
  },
  errorBar: {
    backgroundColor: "#FFF0F0",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F4C7C7",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBarTitle: {
    color: "#A32626",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorBarText: {
    color: "#7D2323",
    fontSize: 13,
    lineHeight: 18,
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centerState: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerStateText: {
    marginTop: 12,
    fontSize: 15,
    color: "#17385F",
  },
  centerErrorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#10243F",
    marginBottom: 8,
  },
  centerErrorText: {
    fontSize: 14,
    color: "#5A6C82",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: "#1565C0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
