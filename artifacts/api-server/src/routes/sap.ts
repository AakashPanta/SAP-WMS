import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import {
  createSapSession,
  submitWarehouseSession,
  submitSapAction,
  getSession,
  destroySession,
  getSessionCount,
  pingServer,
  SapError,
} from "../lib/sapProxy";

const router: IRouter = Router();

const SAP_BASE_URL =
  process.env["SAP_BASE_URL"] ??
  "https://my419914.s4hana.cloud.sap/sap/bc/gui/sap/its/ewm_mobgui?~transaction=/scwm/rfui&sap-language=EN#";
const SAP_DEFAULT_CLIENT = process.env["SAP_DEFAULT_CLIENT"] ?? "100";
const SAP_DEFAULT_LANGUAGE = process.env["SAP_DEFAULT_LANGUAGE"] ?? "EN";
const SAP_TENANT = SAP_BASE_URL.match(/https?:\/\/([^/]+)/)?.[1] ?? "unknown";

function handleSapError(res: Response, err: unknown): void {
  if (err instanceof SapError) {
    const status =
      err.code === "AUTH_FAILED"
        ? 401
        : err.code === "SESSION_EXPIRED"
          ? 401
          : err.code === "SSO_REQUIRED"
            ? 422
            : err.code === "CONFIG_MISSING"
              ? 503
              : err.code === "TIMEOUT"
                ? 504
                : err.code === "NETWORK_ERROR"
                  ? 502
                  : 500;

    res.status(status).json({
      error: true,
      code: err.code,
      message: err.message,
    });
  } else {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    res.status(500).json({ error: true, code: "UNKNOWN", message: msg });
  }
}

router.get("/sap/config", (_req: Request, res: Response) => {
  res.json({
    baseUrl: SAP_BASE_URL,
    tenant: SAP_TENANT,
    defaultClient: SAP_DEFAULT_CLIENT,
    defaultLanguage: SAP_DEFAULT_LANGUAGE,
    configured: true,
    activeSessions: getSessionCount(),
  });
});

router.get("/sap/ping", async (_req: Request, res: Response) => {
  const result = await pingServer(SAP_BASE_URL);
  res.status(200).json({
    ...result,
    tenant: SAP_TENANT,
    baseUrl: SAP_BASE_URL,
  });
});

router.post("/sap/login", async (req: Request, res: Response) => {
  const {
    username,
    password,
    client,
    language,
    warehouseNo,
    resource,
    presDevice,
    transactionCode,
  } = req.body as {
    username?: string;
    password?: string;
    client?: string;
    language?: string;
    warehouseNo?: string;
    resource?: string;
    presDevice?: string;
    transactionCode?: string;
  };

  if (!username || !password) {
    res.status(400).json({
      error: true,
      code: "VALIDATION",
      message: "username and password are required",
    });
    return;
  }
  if (!warehouseNo || !resource) {
    res.status(400).json({
      error: true,
      code: "VALIDATION",
      message: "warehouseNo and resource are required",
    });
    return;
  }

  const sessionId = randomUUID();
  const resolvedClient = client ?? SAP_DEFAULT_CLIENT;
  const resolvedLanguage = language ?? SAP_DEFAULT_LANGUAGE;

  try {
    await createSapSession(sessionId, {
      baseUrl: SAP_BASE_URL,
      client: resolvedClient,
      username,
      password,
      language: resolvedLanguage,
    });

    const result = await submitWarehouseSession(sessionId, {
      warehouseNo,
      resource,
      presDevice,
      transactionCode,
    });

    if (!result.success) {
      destroySession(sessionId);
      res.status(422).json({
        error: true,
        code: "SAP_ERROR",
        message: result.message ?? "SAP rejected the warehouse configuration",
        sapMessages: result.sapMessages,
      });
      return;
    }

    res.json({
      sessionId,
      warehouseNo,
      resource,
      presDevice: presDevice ?? "",
      tenant: SAP_TENANT,
      message: result.message,
      sapMessages: result.sapMessages,
      loginAt: new Date().toISOString(),
    });
  } catch (err) {
    handleSapError(res, err);
  }
});

router.get("/sap/status", async (req: Request, res: Response) => {
  const sessionId = req.headers["x-sap-session"] as string;
  if (!sessionId) {
    res.status(401).json({
      error: true,
      code: "NO_SESSION",
      message: "No session token provided",
    });
    return;
  }

  const session = getSession(sessionId);
  if (!session) {
    res.status(401).json({
      error: true,
      code: "SESSION_EXPIRED",
      message: "Session expired or not found",
    });
    return;
  }

  res.json({
    authenticated: session.authenticated,
    username: session.username,
    client: session.client,
    tenant: SAP_TENANT,
    warehouseNo: session.warehouseNo,
    resource: session.resource,
    presDevice: session.presDevice,
    sessionAge: Math.round((Date.now() - session.createdAt) / 1000),
    lastActivity: Math.round((Date.now() - session.lastActivity) / 1000),
  });
});

router.post("/sap/action", async (req: Request, res: Response) => {
  const sessionId = req.headers["x-sap-session"] as string;
  if (!sessionId) {
    res.status(401).json({
      error: true,
      code: "NO_SESSION",
      message: "No session token provided",
    });
    return;
  }

  const { okCode, fields } = req.body as {
    okCode?: string;
    fields?: Record<string, string>;
  };
  if (!okCode) {
    res.status(400).json({
      error: true,
      code: "VALIDATION",
      message: "okCode is required",
    });
    return;
  }

  try {
    const result = await submitSapAction(sessionId, okCode, fields);
    res.json(result);
  } catch (err) {
    handleSapError(res, err);
  }
});

router.post("/sap/logout", async (req: Request, res: Response) => {
  const sessionId = req.headers["x-sap-session"] as string;
  if (sessionId) {
    destroySession(sessionId);
  }
  res.json({ success: true, message: "Logged out" });
});

export default router;
