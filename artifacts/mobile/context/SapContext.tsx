import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface WarehouseSession {
  sessionId: string;
  username: string;
  client: string;
  warehouseNo: string;
  resource: string;
  presDevice: string;
  sapMessages: string[];
  loginAt: string;
}

export interface StoredCredentials {
  username: string;
  client: string;
}

export interface WarehouseConfig {
  warehouseNo: string;
  resource: string;
  presDevice: string;
}

export interface SapConfig {
  baseUrl: string;
  tenant: string;
  defaultClient: string;
  configured: boolean;
  ping?: {
    reachable: boolean;
    requiresSSO: boolean;
    statusCode: number;
    durationMs: number;
    error?: string;
  };
}

export type AppAuthState =
  | "initializing"
  | "unauthenticated"
  | "authenticated";

interface LoginParams {
  username: string;
  password: string;
  client?: string;
  warehouseNo: string;
  resource: string;
  presDevice?: string;
  rememberMe?: boolean;
}

interface SapContextType {
  authState: AppAuthState;
  session: WarehouseSession | null;
  sapConfig: SapConfig | null;
  storedCredentials: StoredCredentials | null;
  savedWarehouseConfig: WarehouseConfig | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  login: (params: LoginParams) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshStatus: () => Promise<boolean>;
  submitAction: (
    okCode: string,
    fields?: Record<string, string>,
  ) => Promise<{ success: boolean; sapMessages: string[] }>;
  saveWarehouseConfig: (config: WarehouseConfig) => Promise<void>;
}

const SapContext = createContext<SapContextType | null>(null);

const STORAGE_SESSION = "@sap_session_v3";
const STORAGE_CREDENTIALS = "@sap_creds_meta";
const STORAGE_WAREHOUSE = "@sap_warehouse_config";
const SECURE_PASSWORD_KEY = "sap_ewm_password";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;
const REQUEST_TIMEOUT = 25_000;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(`secure_${key}`);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(`secure_${key}`, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(`secure_${key}`);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function apiFetch(
  path: string,
  options: RequestInit & { sessionId?: string } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.sessionId ? { "x-sap-session": options.sessionId } : {}),
    ...(options.headers as Record<string, string>),
  };
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError")
      throw new Error("Request timed out. Check your connection.");
    throw new Error(`Network error: ${err.message}`);
  }
}

export function SapProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AppAuthState>("initializing");
  const [session, setSession] = useState<WarehouseSession | null>(null);
  const [sapConfig, setSapConfig] = useState<SapConfig | null>(null);
  const [storedCredentials, setStoredCredentials] =
    useState<StoredCredentials | null>(null);
  const [savedWarehouseConfig, setSavedWarehouseConfig] =
    useState<WarehouseConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      await Promise.all([fetchSapConfig(), loadWarehouseConfig()]);
      const restored = await tryRestoreSession();
      setAuthState(restored ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  };

  const fetchSapConfig = async () => {
    try {
      const [configRes, pingRes] = await Promise.allSettled([
        apiFetch("/sap/config"),
        apiFetch("/sap/ping"),
      ]);
      if (configRes.status === "fulfilled" && configRes.value.ok) {
        const config = (await configRes.value.json()) as SapConfig;
        if (pingRes.status === "fulfilled" && pingRes.value.ok) {
          const ping = await pingRes.value.json();
          setSapConfig({ ...config, ping });
        } else {
          setSapConfig(config);
        }
      }
    } catch {}
  };

  const loadWarehouseConfig = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_WAREHOUSE);
      if (raw) setSavedWarehouseConfig(JSON.parse(raw) as WarehouseConfig);
    } catch {}
  };

  const tryRestoreSession = async (): Promise<boolean> => {
    try {
      const rawSession = await AsyncStorage.getItem(STORAGE_SESSION);
      const rawCreds = await AsyncStorage.getItem(STORAGE_CREDENTIALS);
      if (!rawCreds) return false;

      const creds = JSON.parse(rawCreds) as StoredCredentials;
      setStoredCredentials(creds);

      if (rawSession) {
        const savedSession = JSON.parse(rawSession) as WarehouseSession;
        const res = await apiFetch("/sap/status", {
          sessionId: savedSession.sessionId,
        });
        if (res.ok) {
          setSession(savedSession);
          return true;
        }
      }

      const password = await secureGet(SECURE_PASSWORD_KEY);
      if (!password) return false;

      const rawWarehouse = await AsyncStorage.getItem(STORAGE_WAREHOUSE);
      const warehouseConfig = rawWarehouse
        ? (JSON.parse(rawWarehouse) as WarehouseConfig)
        : null;
      if (!warehouseConfig) return false;

      const res = await apiFetch("/sap/login", {
        method: "POST",
        body: JSON.stringify({
          username: creds.username,
          password,
          client: creds.client,
          warehouseNo: warehouseConfig.warehouseNo,
          resource: warehouseConfig.resource,
          presDevice: warehouseConfig.presDevice,
        }),
      });

      if (!res.ok) return false;
      const data = (await res.json()) as any;
      const restoredSession: WarehouseSession = {
        sessionId: data.sessionId,
        username: creds.username,
        client: creds.client,
        warehouseNo: data.warehouseNo,
        resource: data.resource,
        presDevice: data.presDevice ?? "",
        sapMessages: data.sapMessages ?? [],
        loginAt: data.loginAt ?? new Date().toISOString(),
      };
      await AsyncStorage.setItem(
        STORAGE_SESSION,
        JSON.stringify(restoredSession),
      );
      setSession(restoredSession);
      return true;
    } catch {
      return false;
    }
  };

  const login = useCallback(
    async (params: LoginParams): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      const resolvedClient =
        params.client?.trim() || sapConfig?.defaultClient || "100";
      const remember = params.rememberMe !== false;

      try {
        const res = await apiFetch("/sap/login", {
          method: "POST",
          body: JSON.stringify({
            username: params.username.trim(),
            password: params.password,
            client: resolvedClient,
            warehouseNo: params.warehouseNo.trim().toUpperCase(),
            resource: params.resource.trim().toUpperCase(),
            presDevice: (params.presDevice ?? "").trim().toUpperCase(),
          }),
        });

        const data = (await res.json()) as any;

        if (!res.ok) {
          setError(data.message ?? "Login failed");
          setErrorCode(data.code ?? "UNKNOWN");
          return false;
        }

        const newSession: WarehouseSession = {
          sessionId: data.sessionId,
          username: params.username.trim(),
          client: resolvedClient,
          warehouseNo: data.warehouseNo,
          resource: data.resource,
          presDevice: data.presDevice ?? "",
          sapMessages: data.sapMessages ?? [],
          loginAt: data.loginAt ?? new Date().toISOString(),
        };

        const credsToStore: StoredCredentials = {
          username: params.username.trim(),
          client: resolvedClient,
        };
        const warehouseToStore: WarehouseConfig = {
          warehouseNo: data.warehouseNo,
          resource: data.resource,
          presDevice: data.presDevice ?? "",
        };

        const storeTasks: Promise<any>[] = [
          AsyncStorage.setItem(STORAGE_SESSION, JSON.stringify(newSession)),
          AsyncStorage.setItem(STORAGE_WAREHOUSE, JSON.stringify(warehouseToStore)),
        ];
        if (remember) {
          storeTasks.push(
            AsyncStorage.setItem(STORAGE_CREDENTIALS, JSON.stringify(credsToStore)),
            secureSet(SECURE_PASSWORD_KEY, params.password),
          );
        } else {
          storeTasks.push(
            AsyncStorage.removeItem(STORAGE_CREDENTIALS),
            secureDelete(SECURE_PASSWORD_KEY),
          );
        }
        await Promise.all(storeTasks);

        setSession(newSession);
        setStoredCredentials(remember ? credsToStore : null);
        setSavedWarehouseConfig(warehouseToStore);
        setAuthState("authenticated");
        return true;
      } catch (err: any) {
        const msg =
          err instanceof Error ? err.message : "Failed to connect to SAP";
        setError(msg);
        setErrorCode("NETWORK_ERROR");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [sapConfig],
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (session?.sessionId) {
        await apiFetch("/sap/logout", {
          method: "POST",
          sessionId: session.sessionId,
        }).catch(() => {});
      }
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_SESSION),
        AsyncStorage.removeItem(STORAGE_CREDENTIALS),
        secureDelete(SECURE_PASSWORD_KEY),
      ]);
      setSession(null);
      setStoredCredentials(null);
      setAuthState("unauthenticated");
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    if (!session?.sessionId) return false;
    try {
      const res = await apiFetch("/sap/status", {
        sessionId: session.sessionId,
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [session]);

  const submitAction = useCallback(
    async (okCode: string, fields?: Record<string, string>) => {
      if (!session?.sessionId) throw new Error("No active session");
      const res = await apiFetch("/sap/action", {
        method: "POST",
        sessionId: session.sessionId,
        body: JSON.stringify({ okCode, fields }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.message ?? "Action failed");
      return { success: true, sapMessages: data.sapMessages ?? [] };
    },
    [session],
  );

  const saveWarehouseConfig = useCallback(async (config: WarehouseConfig) => {
    await AsyncStorage.setItem(STORAGE_WAREHOUSE, JSON.stringify(config));
    setSavedWarehouseConfig(config);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  return (
    <SapContext.Provider
      value={{
        authState,
        session,
        sapConfig,
        storedCredentials,
        savedWarehouseConfig,
        isLoading,
        error,
        errorCode,
        login,
        logout,
        clearError,
        refreshStatus,
        submitAction,
        saveWarehouseConfig,
      }}
    >
      {children}
    </SapContext.Provider>
  );
}

export function useSap() {
  const ctx = useContext(SapContext);
  if (!ctx) throw new Error("useSap must be used within SapProvider");
  return ctx;
}
