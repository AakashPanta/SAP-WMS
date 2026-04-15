import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview";

const SAP_RFUI_URL =
  "https://my419914.s4hana.cloud.sap/sap/bc/gui/sap/its/ewm_mobgui?~transaction=/scwm/rfui&sap-language=EN#";

const ALLOWED_HOSTS = [
  "my419914.s4hana.cloud.sap",
  "aoayy8srk.accounts.cloud.sap",
];

type Stage =
  | "boot"
  | "login"
  | "authenticating"
  | "warehouse"
  | "submittingWarehouse"
  | "ready";

type SapPageKind =
  | "unknown"
  | "login"
  | "rfui-logon"
  | "rfui"
  | "rfui-error";

type SapPageSnapshot = {
  url: string;
  host: string;
  title: string;
  kind: SapPageKind;
  messages: string[];
  hasWarehouse: boolean;
  hasResource: boolean;
  hasDevice: boolean;
  resourceValue: string;
  warehouseValue: string;
  deviceValue: string;
  isErrorPage: boolean;
};

function escapeForInjectedJs(value: string) {
  return JSON.stringify(value);
}

const INSPECT_PAGE_JS = `
(function () {
  function unique(values) {
    var out = [];
    for (var i = 0; i < values.length; i += 1) {
      var v = String(values[i] || "").replace(/\\s+/g, " ").trim();
      if (v && out.indexOf(v) === -1) out.push(v);
    }
    return out;
  }

  function safeText(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }

  function lower(value) {
    return safeText(value).toLowerCase();
  }

  function collectMessages() {
    var selectors = [
      '[role="alert"]',
      '.urMsgBar',
      '.urTxtErr',
      '.message',
      '.sapMMsgStrip',
      '.sapMMessageStrip',
      '.sapUiMessage',
      '.error',
      '.warning',
      '.info'
    ];

    var items = [];
    selectors.forEach(function (selector) {
      var nodes = document.querySelectorAll(selector);
      for (var i = 0; i < nodes.length; i += 1) {
        var text = safeText(nodes[i].innerText || nodes[i].textContent || "");
        if (text) items.push(text);
      }
    });

    var bodyText = document.body ? safeText(document.body.innerText || "") : "";
    if (bodyText) {
      var lines = bodyText.split(/\\n+/).map(safeText).filter(Boolean);
      items = items.concat(
        lines.filter(function (line) {
          var t = line.toLowerCase();
          return (
            t.indexOf("stop application") >= 0 ||
            t.indexOf("invalid") >= 0 ||
            t.indexOf("incorrect") >= 0 ||
            t.indexOf("error") >= 0 ||
            t.indexOf("failed") >= 0 ||
            t.indexOf("warning") >= 0
          );
        })
      );
    }

    return unique(items).slice(0, 8);
  }

  function getInputMeta() {
    return Array.prototype.slice.call(
      document.querySelectorAll("input, textarea, select")
    ).map(function (el) {
      return {
        name: safeText(el.getAttribute("name") || ""),
        id: safeText(el.getAttribute("id") || ""),
        type: safeText(el.getAttribute("type") || el.tagName || "").toLowerCase(),
        placeholder: safeText(el.getAttribute("placeholder") || ""),
        value: safeText(el.value || el.getAttribute("value") || ""),
      };
    });
  }

  function findField(inputs, hints) {
    for (var i = 0; i < inputs.length; i += 1) {
      var hay = lower(
        inputs[i].name + " " +
        inputs[i].id + " " +
        inputs[i].placeholder
      );
      for (var j = 0; j < hints.length; j += 1) {
        if (hay.indexOf(hints[j]) >= 0) return inputs[i];
      }
    }
    return null;
  }

  function inspectPage() {
    try {
      var host = location.host || "";
      var title = safeText(document.title || "");
      var bodyText = document.body ? safeText(document.body.innerText || "") : "";
      var lowerBody = bodyText.toLowerCase();

      var inputs = getInputMeta();
      var hasPassword = !!document.querySelector('input[type="password"]');

      var warehouseField = findField(inputs, ["warehouse", "lgnum"]);
      var resourceField = findField(inputs, ["resource", "rsrc"]);
      var deviceField = findField(inputs, ["presentation", "device", "pres", "disp"]);

      var hasWarehouse =
        !!warehouseField ||
        lowerBody.indexOf("warehouse") >= 0;

      var hasResource =
        !!resourceField ||
        lowerBody.indexOf("resource") >= 0;

      var hasDevice =
        !!deviceField ||
        lowerBody.indexOf("pres. dev") >= 0 ||
        lowerBody.indexOf("presentation device") >= 0;

      var warehouseValue = warehouseField ? warehouseField.value : "";
      var resourceValue = resourceField ? resourceField.value : "";
      var deviceValue = deviceField ? deviceField.value : "";

      var messages = collectMessages();
      var combinedErrorText = lower(title + " " + bodyText + " " + messages.join(" "));
      var isErrorPage =
        combinedErrorText.indexOf("stop application") >= 0 ||
        combinedErrorText.indexOf("invalid link") >= 0 ||
        combinedErrorText.indexOf("could not reach the sap server") >= 0 ||
        combinedErrorText.indexOf("network error") >= 0 ||
        combinedErrorText.indexOf("application error") >= 0;

      var kind = "unknown";
      if (host.indexOf("accounts.cloud.sap") >= 0 || hasPassword) {
        kind = "login";
      } else if (host.indexOf("s4hana.cloud.sap") >= 0 && isErrorPage) {
        kind = "rfui-error";
      } else if (
        host.indexOf("s4hana.cloud.sap") >= 0 &&
        hasWarehouse &&
        hasResource &&
        hasDevice &&
        (!resourceValue || !deviceValue || !warehouseValue)
      ) {
        kind = "rfui-logon";
      } else if (host.indexOf("s4hana.cloud.sap") >= 0) {
        kind = "rfui";
      }

      var payload = {
        type: "PAGE_STATE",
        payload: {
          url: location.href,
          host: host,
          title: title || "SAP",
          kind: kind,
          messages: messages,
          hasWarehouse: hasWarehouse,
          hasResource: hasResource,
          hasDevice: hasDevice,
          warehouseValue: warehouseValue,
          resourceValue: resourceValue,
          deviceValue: deviceValue,
          isErrorPage: isErrorPage
        }
      };

      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    } catch (error) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "PAGE_STATE_ERROR",
          error: String(error && error.message ? error.message : error),
        })
      );
    }
  }

  setTimeout(inspectPage, 50);
  setTimeout(inspectPage, 500);
  setTimeout(inspectPage, 1500);
  document.addEventListener("DOMContentLoaded", inspectPage);
  window.addEventListener("load", inspectPage);
})();
true;
`;

function createLoginInjection(
  username: string,
  password: string,
  keepSignedIn: boolean,
) {
  return `
(function () {
  try {
    function post(message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function setNativeValue(el, value) {
      var last = el.value;
      el.focus();
      el.value = value;
      var tracker = el._valueTracker;
      if (tracker) tracker.setValue(last);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    }

    function getText(node) {
      return String(node && (node.innerText || node.textContent) || "")
        .replace(/\\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    var inputs = Array.prototype.slice.call(document.querySelectorAll("input"));
    var usernameField =
      document.querySelector('input[type="email"]') ||
      inputs.find(function (el) {
        var hay = (
          (el.name || "") + " " +
          (el.id || "") + " " +
          (el.placeholder || "") + " " +
          (el.autocomplete || "")
        ).toLowerCase();
        return hay.indexOf("user") >= 0 || hay.indexOf("email") >= 0 || hay.indexOf("login") >= 0;
      }) ||
      inputs.find(function (el) {
        var type = String(el.type || "").toLowerCase();
        return type === "text" || type === "email";
      });

    var passwordField = document.querySelector('input[type="password"]');

    if (!usernameField || !passwordField) {
      post({
        type: "ACTION_RESULT",
        action: "login",
        ok: false,
        error: "Login fields not found on SAP page.",
      });
      return true;
    }

    setNativeValue(usernameField, ${escapeForInjectedJs("__USERNAME__")});
    setNativeValue(passwordField, ${escapeForInjectedJs("__PASSWORD__")});

    if (${keepSignedIn ? "true" : "false"}) {
      var checkbox = Array.prototype.slice
        .call(document.querySelectorAll('input[type="checkbox"]'))
        .find(function (el) {
          var labelText = "";
          if (el.id) {
            var label = document.querySelector('label[for="' + el.id + '"]');
            labelText = getText(label);
          }
          var combined = (labelText + " " + (el.name || "") + " " + (el.id || "")).toLowerCase();
          return combined.indexOf("keep me signed in") >= 0 || combined.indexOf("remember") >= 0 || combined.indexOf("keep") >= 0;
        });

      if (checkbox && !checkbox.checked) checkbox.click();
    }

    var submitButton =
      Array.prototype.slice
        .call(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
        .find(function (el) {
          var label = getText(el) || String(el.value || "").toLowerCase();
          return label.indexOf("continue") >= 0 || label.indexOf("sign in") >= 0 || label.indexOf("login") >= 0 || label.indexOf("log on") >= 0;
        });

    if (submitButton) {
      submitButton.click();
    } else if (passwordField.form) {
      if (typeof passwordField.form.requestSubmit === "function") passwordField.form.requestSubmit();
      else passwordField.form.submit();
    }

    post({ type: "ACTION_RESULT", action: "login", ok: true, status: "submitted" });
  } catch (error) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: "ACTION_RESULT",
        action: "login",
        ok: false,
        error: String(error && error.message ? error.message : error),
      })
    );
  }
})();
true;
`.replace("__USERNAME__", username).replace("__PASSWORD__", password);
}

function createWarehouseInjection(
  warehouse: string,
  resource: string,
  device: string,
) {
  return `
(function () {
  try {
    function post(message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    function setNativeValue(el, value) {
      var last = el.value;
      el.focus();
      el.value = value;
      var tracker = el._valueTracker;
      if (tracker) tracker.setValue(last);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.blur();
    }

    function findByHints(hints) {
      var elements = Array.prototype.slice.call(
        document.querySelectorAll('input:not([type]), input[type="text"], textarea')
      );

      return elements.find(function (el) {
        var hay = (
          (el.name || "") + " " +
          (el.id || "") + " " +
          (el.placeholder || "")
        ).toLowerCase();

        return hints.some(function (hint) {
          return hay.indexOf(hint) >= 0;
        });
      }) || null;
    }

    var textInputs = Array.prototype.slice.call(
      document.querySelectorAll('input:not([type]), input[type="text"], textarea')
    );

    var warehouseField = findByHints(["warehouse", "lgnum"]) || textInputs[0] || null;
    var resourceField = findByHints(["resource", "rsrc"]) || textInputs[1] || null;
    var deviceField = findByHints(["presentation", "device", "pres", "disp"]) || textInputs[2] || null;

    if (!warehouseField || !resourceField || !deviceField) {
      post({
        type: "ACTION_RESULT",
        action: "warehouse",
        ok: false,
        error: "RFUI logon fields not found on SAP page.",
      });
      return true;
    }

    setNativeValue(warehouseField, ${escapeForInjectedJs("__WAREHOUSE__")});
    setNativeValue(resourceField, ${escapeForInjectedJs("__RESOURCE__")});
    setNativeValue(deviceField, ${escapeForInjectedJs("__DEVICE__")});

    var submitButton =
      Array.prototype.slice
        .call(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
        .find(function (el) {
          var label = String(el.innerText || el.textContent || el.value || "")
            .replace(/\\s+/g, " ")
            .trim()
            .toLowerCase();

          return (
            label.indexOf("enter") >= 0 ||
            label.indexOf("continue") >= 0 ||
            label.indexOf("log on") >= 0 ||
            label.indexOf("connect") >= 0 ||
            label.indexOf("f2") >= 0
          );
        });

    if (submitButton) {
      submitButton.click();
    } else if (deviceField.form) {
      if (typeof deviceField.form.requestSubmit === "function") deviceField.form.requestSubmit();
      else deviceField.form.submit();
    } else {
      deviceField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      deviceField.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    }

    post({ type: "ACTION_RESULT", action: "warehouse", ok: true, status: "submitted" });
  } catch (error) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: "ACTION_RESULT",
        action: "warehouse",
        ok: false,
        error: String(error && error.message ? error.message : error),
      })
    );
  }
})();
true;
`
    .replace("__WAREHOUSE__", warehouse)
    .replace("__RESOURCE__", resource)
    .replace("__DEVICE__", device);
}

export default function IndexScreen() {
  const webViewRef = useRef<WebView>(null);
  const resourceInputRef = useRef<TextInput>(null);
  const deviceInputRef = useRef<TextInput>(null);

  const [stage, setStage] = useState<Stage>("boot");
  const [page, setPage] = useState<SapPageSnapshot | null>(null);
  const [showLiveSap, setShowLiveSap] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [warehouse, setWarehouse] = useState("RM01");
  const [resource, setResource] = useState("");
  const [presentationDevice, setPresentationDevice] = useState("SE01");

  const [infoText, setInfoText] = useState("Preparing SAP...");
  const [errorText, setErrorText] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);

  const allowedHosts = useMemo(() => ALLOWED_HOSTS, []);

  const hasBlockingError = (snapshot: SapPageSnapshot | null) => {
    if (!snapshot) return false;
    if (snapshot.isErrorPage) return true;
    return snapshot.messages.some((message) => {
      const text = message.toLowerCase();
      return (
        text.includes("stop application") ||
        text.includes("invalid") ||
        text.includes("failed") ||
        text.includes("error")
      );
    });
  };

  const isRealConnectedRfui = (snapshot: SapPageSnapshot | null) => {
    if (!snapshot) return false;
    if (snapshot.kind !== "rfui") return false;
    if (snapshot.isErrorPage) return false;
    if (hasBlockingError(snapshot)) return false;
    return true;
  };

  useEffect(() => {
    if (!page) return;

    if (hasBlockingError(page)) {
      if (page.kind === "login") {
        setStage("login");
      } else if (page.kind === "rfui-logon" || page.kind === "rfui-error") {
        setStage("warehouse");
      }
      if (page.messages.length) {
        setErrorText(page.messages[0]);
      }
      return;
    }

    if (stage === "boot") {
      if (page.kind === "login") {
        setStage("login");
        setInfoText("Sign in with your SAP account.");
      } else if (page.kind === "rfui-logon") {
        setStage("warehouse");
        setInfoText("SAP session found. Complete warehouse setup.");
      } else if (isRealConnectedRfui(page)) {
        setStage("ready");
        setInfoText("Connected to SAP.");
      }
      return;
    }

    if (stage === "authenticating") {
      if (page.kind === "rfui-logon") {
        setStage("warehouse");
        setErrorText("");
        setInfoText("SAP login successful. Complete warehouse setup.");
      } else if (isRealConnectedRfui(page)) {
        setStage("ready");
        setErrorText("");
        setInfoText("SAP login successful.");
      } else if (page.kind === "login" && page.messages.length) {
        setStage("login");
        setErrorText(page.messages[0]);
      }
      return;
    }

    if (stage === "submittingWarehouse") {
      if (isRealConnectedRfui(page)) {
        setStage("ready");
        setErrorText("");
        setInfoText("Warehouse session connected successfully.");
      } else if (
        page.kind === "rfui-logon" ||
        page.kind === "rfui-error" ||
        page.messages.length
      ) {
        setStage("warehouse");
        if (page.messages.length) {
          setErrorText(page.messages[0]);
        }
      }
    }
  }, [page, stage]);

  const inject = (script: string) => {
    webViewRef.current?.injectJavaScript(script);
  };

  const injectInspector = () => {
    inject(INSPECT_PAGE_JS);
  };

  const navigateHome = () => {
    setErrorText("");
    setInfoText("Opening SAP...");
    inject(\`window.location.href = \${${escapeForInjectedJs(SAP_RFUI_URL)}}; true;\`);
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "PAGE_STATE" && data.payload) {
        const nextPage: SapPageSnapshot = {
          url: data.payload.url ?? "",
          host: data.payload.host ?? "",
          title: data.payload.title ?? "SAP",
          kind: data.payload.kind ?? "unknown",
          messages: Array.isArray(data.payload.messages) ? data.payload.messages : [],
          hasWarehouse: !!data.payload.hasWarehouse,
          hasResource: !!data.payload.hasResource,
          hasDevice: !!data.payload.hasDevice,
          warehouseValue: data.payload.warehouseValue ?? "",
          resourceValue: data.payload.resourceValue ?? "",
          deviceValue: data.payload.deviceValue ?? "",
          isErrorPage: !!data.payload.isErrorPage,
        };

        setPage(nextPage);

        if (nextPage.messages.length && stage !== "ready") {
          setErrorText(nextPage.messages[0]);
        }
        return;
      }

      if (data.type === "ACTION_RESULT") {
        if (!data.ok && data.error) {
          setErrorText(String(data.error));
          if (data.action === "login") {
            setStage("login");
          } else if (data.action === "warehouse") {
            setStage("warehouse");
          }
        }
      }
    } catch {}
  };

  const submitLogin = () => {
    const trimmedUser = username.trim();
    const trimmedPass = password;

    if (!trimmedUser || !trimmedPass) {
      setErrorText("Enter your SAP email/username and password.");
      return;
    }

    if (page?.kind === "rfui-logon") {
      setStage("warehouse");
      setErrorText("");
      return;
    }

    if (isRealConnectedRfui(page)) {
      setStage("ready");
      setErrorText("");
      return;
    }

    setErrorText("");
    setInfoText("Signing in to SAP...");
    setStage("authenticating");
    inject(createLoginInjection(trimmedUser, trimmedPass, keepSignedIn));
  };

  const submitWarehouse = () => {
    const trimmedWarehouse = warehouse.trim();
    const trimmedResource = resource.trim();
    const trimmedDevice = (presentationDevice || "SE01").trim();

    if (!trimmedWarehouse || !trimmedResource || !trimmedDevice) {
      setErrorText("Fill Warehouse No., Resource, and Dflt Pres. Dev.");
      return;
    }

    if (isRealConnectedRfui(page)) {
      setStage("ready");
      setErrorText("");
      return;
    }

    setErrorText("");
    setInfoText("Connecting warehouse session...");
    setStage("submittingWarehouse");
    inject(
      createWarehouseInjection(
        trimmedWarehouse,
        trimmedResource,
        trimmedDevice,
      ),
    );
  };

  const resetSession = () => {
    setShowLiveSap(false);
    setStage("boot");
    setErrorText("");
    setInfoText("Resetting SAP session...");
    setUsername("");
    setPassword("");
    setResource("");
    setPresentationDevice("SE01");
    navigateHome();
  };

  const renderTopCard = () => (
    <View style={styles.heroCard}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>SAP</Text>
        </View>

        <View style={styles.logoMeta}>
          <Text style={styles.title}>SAP WMS</Text>
          <Text style={styles.subtitle}>
            Native UI with real SAP backend session
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {page?.kind === "login"
              ? "SAP Login"
              : page?.kind === "rfui-logon"
                ? "Warehouse Setup"
                : page?.kind === "rfui-error"
                  ? "SAP Error"
                  : page?.kind === "rfui"
                    ? "SAP Session Ready"
                    : "Connecting"}
          </Text>
        </View>

        <Text style={styles.pageText} numberOfLines={1}>
          {page?.title || "Loading SAP..."}
        </Text>
      </View>

      <Text style={styles.infoText}>{infoText}</Text>

      {!!errorText && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>SAP Message</Text>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      )}
    </View>
  );

  const renderLogin = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Sign in</Text>
      <Text style={styles.cardSubtitle}>
        Your UI stays native. SAP login runs in the background.
      </Text>

      <Text style={styles.label}>Email or username</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Enter SAP username"
        placeholderTextColor="#7E8EA7"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        returnKeyType="next"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Enter password"
        placeholderTextColor="#7E8EA7"
        secureTextEntry
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={submitLogin}
      />

      <TouchableOpacity
        style={styles.keepSignedRow}
        onPress={() => setKeepSignedIn((current) => !current)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.checkbox,
            keepSignedIn && styles.checkboxChecked,
          ]}
        >
          {keepSignedIn ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>

        <Text style={styles.keepSignedText}>Keep me signed in</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          stage === "authenticating" && styles.primaryButtonDisabled,
        ]}
        disabled={stage === "authenticating"}
        onPress={submitLogin}
      >
        {stage === "authenticating" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderWarehouse = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Warehouse setup</Text>
      <Text style={styles.cardSubtitle}>
        These values are submitted to the real SAP RFUI page in the background.
      </Text>

      <Text style={styles.label}>Warehouse No.</Text>
      <TextInput
        value={warehouse}
        onChangeText={setWarehouse}
        placeholder="RM01"
        placeholderTextColor="#7E8EA7"
        autoCapitalize="characters"
        style={styles.input}
        returnKeyType="next"
        onSubmitEditing={() => resourceInputRef.current?.focus()}
      />

      <Text style={styles.label}>Resource</Text>
      <TextInput
        ref={resourceInputRef}
        value={resource}
        onChangeText={setResource}
        placeholder="CS02-LAL"
        placeholderTextColor="#7E8EA7"
        autoCapitalize="characters"
        style={styles.input}
        returnKeyType="next"
        onSubmitEditing={() => {
          if (!presentationDevice.trim()) {
            setPresentationDevice("SE01");
          }
          deviceInputRef.current?.focus();
        }}
      />

      <Text style={styles.label}>Dflt Pres. Dev.</Text>
      <TextInput
        ref={deviceInputRef}
        value={presentationDevice}
        onChangeText={setPresentationDevice}
        placeholder="SE01"
        placeholderTextColor="#7E8EA7"
        autoCapitalize="characters"
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={submitWarehouse}
      />

      <TouchableOpacity
        style={[
          styles.primaryButton,
          stage === "submittingWarehouse" && styles.primaryButtonDisabled,
        ]}
        disabled={stage === "submittingWarehouse"}
        onPress={submitWarehouse}
      >
        {stage === "submittingWarehouse" ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>Connect to Warehouse</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderReady = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>SAP session connected</Text>
      <Text style={styles.cardSubtitle}>
        Your app UI stayed native and SAP is running underneath.
      </Text>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Warehouse</Text>
          <Text style={styles.summaryValue}>
            {page?.warehouseValue || warehouse || "—"}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Resource</Text>
          <Text style={styles.summaryValue}>
            {page?.resourceValue || resource || "—"}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Device</Text>
          <Text style={styles.summaryValue}>
            {page?.deviceValue || presentationDevice || "—"}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>SAP Host</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {page?.host || "—"}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setShowLiveSap(true)}
      >
        <Text style={styles.primaryButtonText}>Open Live SAP Screen</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={resetSession}>
        <Text style={styles.secondaryButtonText}>Reset SAP Session</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1E3A" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {renderTopCard()}
          {stage === "boot" && (
            <View style={styles.card}>
              <View style={styles.bootRow}>
                <ActivityIndicator size="large" color="#1565C0" />
                <Text style={styles.bootText}>Connecting to SAP...</Text>
              </View>
            </View>
          )}
          {(stage === "login" || stage === "authenticating") && renderLogin()}
          {(stage === "warehouse" || stage === "submittingWarehouse") && renderWarehouse()}
          {stage === "ready" && renderReady()}
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={showLiveSap ? styles.liveSapOverlay : styles.hiddenWebViewHost}
        pointerEvents={showLiveSap ? "auto" : "none"}
      >
        {showLiveSap && (
          <View style={styles.liveHeader}>
            <Text style={styles.liveHeaderTitle}>Live SAP</Text>

            <View style={styles.liveHeaderButtons}>
              <TouchableOpacity
                style={styles.liveHeaderButton}
                onPress={() => webViewRef.current?.goBack()}
                disabled={!canGoBack}
              >
                <Text
                  style={[
                    styles.liveHeaderButtonText,
                    !canGoBack && styles.liveHeaderButtonTextDisabled,
                  ]}
                >
                  Back
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liveHeaderButton}
                onPress={() => webViewRef.current?.reload()}
              >
                <Text style={styles.liveHeaderButtonText}>Refresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.liveHeaderButton}
                onPress={() => setShowLiveSap(false)}
              >
                <Text style={styles.liveHeaderButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: SAP_RFUI_URL }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          mixedContentMode="compatibility"
          originWhitelist={["*"]}
          cacheEnabled
          incognito={false}
          onLoadEnd={injectInspector}
          injectedJavaScript={INSPECT_PAGE_JS}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationChange}
          onShouldStartLoadWithRequest={(request) => {
            try {
              if (request.url.startsWith("about:blank")) return true;
              const host = new URL(request.url).host;
              return allowedHosts.includes(host);
            } catch {
              return false;
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#081A31" },
  contentContainer: { padding: 16, paddingBottom: 28 },
  heroCard: {
    backgroundColor: "#0F2747",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1A3B67",
  },
  logoWrap: { flexDirection: "row", alignItems: "center" },
  logoBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#1565C0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  logoMeta: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#BCD1EA", fontSize: 13, marginTop: 4 },
  statusRow: { marginTop: 18, marginBottom: 12 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#183B67",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  pageText: { color: "#D8E5F3", fontSize: 13 },
  infoText: { color: "#D8E5F3", fontSize: 13, lineHeight: 19 },
  errorBox: {
    marginTop: 14,
    backgroundColor: "#FFECEC",
    borderRadius: 16,
    padding: 14,
  },
  errorTitle: {
    color: "#A22323",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#7D2525",
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#F6F9FE",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: { color: "#10243F", fontSize: 20, fontWeight: "800" },
  cardSubtitle: {
    color: "#5E7088",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 16,
  },
  label: {
    color: "#1B3557",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5E1F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#10243F",
    fontSize: 15,
  },
  keepSignedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A9BED9",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#1565C0",
    borderColor: "#1565C0",
  },
  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  keepSignedText: {
    color: "#1B3557",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#1565C0",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#C8D7EA",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    color: "#163A63",
    fontSize: 15,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
    marginHorizontal: -6,
  },
  summaryCard: { width: "50%", padding: 6 },
  summaryLabel: {
    color: "#5E7088",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  summaryValue: {
    color: "#10243F",
    fontSize: 15,
    fontWeight: "800",
  },
  bootRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  bootText: {
    marginTop: 14,
    color: "#163A63",
    fontSize: 15,
    fontWeight: "700",
  },
  hiddenWebViewHost: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    bottom: 0,
    right: 0,
    overflow: "hidden",
  },
  liveSapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#081A31",
    zIndex: 20,
  },
  liveHeader: {
    backgroundColor: "#0F2747",
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "android" ? 14 : 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A3B67",
  },
  liveHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  liveHeaderButtons: { flexDirection: "row" },
  liveHeaderButton: {
    backgroundColor: "#183B67",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  liveHeaderButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  liveHeaderButtonTextDisabled: { opacity: 0.45 },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
