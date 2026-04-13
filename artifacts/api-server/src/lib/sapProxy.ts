import * as cheerio from "cheerio";
import { logger } from "./logger";

export type SapErrorCode =
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "SAP_ERROR"
  | "SESSION_EXPIRED"
  | "CONFIG_MISSING"
  | "TIMEOUT"
  | "PARSE_ERROR"
  | "SSO_REQUIRED";

export class SapError extends Error {
  constructor(
    public code: SapErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SapError";
  }
}

interface SapCookies {
  [key: string]: string;
}

export interface SapSession {
  id: string;
  cookies: SapCookies;
  baseUrl: string;
  client: string;
  username: string;
  warehouseNo?: string;
  resource?: string;
  presDevice?: string;
  createdAt: number;
  lastActivity: number;
  authenticated: boolean;
}

export interface SapActionResult {
  success: boolean;
  message?: string;
  sapMessages: string[];
  nextScreen?: string;
  formFields?: Record<string, string>;
  rawHtml?: string;
}

const SESSION_TTL = 30 * 60 * 1000;
const REQUEST_TIMEOUT = 20_000;
const sessionStore = new Map<string, SapSession>();

setInterval(
  () => {
    const now = Date.now();
    for (const [id, session] of sessionStore) {
      if (now - session.lastActivity > SESSION_TTL) {
        sessionStore.delete(id);
        logger.info({ sessionId: id }, "SAP session expired and removed");
      }
    }
  },
  5 * 60 * 1000,
);

function cookiesToHeader(cookies: SapCookies): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function parseSetCookies(headers: Headers): SapCookies {
  const result: SapCookies = {};
  let raw: string[] = [];

  if (typeof (headers as any).getSetCookie === "function") {
    raw = (headers as any).getSetCookie() as string[];
  } else {
    const single = headers.get("set-cookie");
    if (single) raw = [single];
  }

  for (const header of raw) {
    const [pair] = header.split(";");
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (name) result[name] = value;
    }
  }

  return result;
}

function mergeCookies(base: SapCookies, incoming: SapCookies): SapCookies {
  return { ...base, ...incoming };
}

function browserHeaders(
  cookies?: SapCookies,
  referer?: string,
  isPost = false,
): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
    ...(isPost
      ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
      : {}),
    ...(cookies ? { Cookie: cookiesToHeader(cookies) } : {}),
  };
}

async function sapFetch(
  url: string,
  options: RequestInit & { cookies?: SapCookies; referer?: string } = {},
): Promise<{ response: Response; text: string; newCookies: SapCookies; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const isPost = options.method === "POST";
  const headers = browserHeaders(options.cookies, options.referer, isPost);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const newCookies = parseSetCookies(response.headers);
    const text = await response.text();
    const finalUrl = response.url || url;
    return { response, text, newCookies, finalUrl };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new SapError("TIMEOUT", "SAP server did not respond in time");
    }
    throw new SapError(
      "NETWORK_ERROR",
      `Cannot reach SAP server: ${err.message}`,
    );
  }
}

function extractSapMessages(html: string): string[] {
  const $ = cheerio.load(html);
  const messages: string[] = [];

  const selectors = [
    ".sapError",
    ".sapWarning",
    ".sapInfo",
    "[class*='msgErr']",
    "[class*='msgWrn']",
    "[class*='msgInf']",
    "#MSGGUI",
    ".sapM",
    "div[id*='MSG']",
    "span[id*='MSG']",
    "td.msgStatus",
    "td.msgtext",
    ".notification",
    "div.errormessage",
    "span.error-text",
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text && !messages.includes(text)) messages.push(text);
    });
  }

  return messages.filter((m) => m.length > 0 && m.length < 500);
}

function extractFormFields(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") ?? "";
    if (name) fields[name] = value;
  });

  return fields;
}

function extractFormAction(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);
  const action = $("form").first().attr("action");
  if (!action) return baseUrl;
  if (action.startsWith("http")) return action;
  try {
    const url = new URL(baseUrl);
    return action.startsWith("/")
      ? `${url.origin}${action}`
      : `${url.origin}/${action}`;
  } catch {
    return baseUrl;
  }
}

function isLoginPage(html: string, finalUrl?: string): boolean {
  const lower = html.toLowerCase();
  if (finalUrl) {
    const urlLower = finalUrl.toLowerCase();
    if (
      urlLower.includes("logon") ||
      urlLower.includes("login") ||
      urlLower.includes("/sap/bc/ui2/flp/logon") ||
      urlLower.includes("accounts.sap.com") ||
      urlLower.includes("idp.")
    ) {
      return true;
    }
  }
  return (
    lower.includes('name="sap-user"') ||
    lower.includes('name="sap-password"') ||
    lower.includes("sap-logon") ||
    lower.includes("logon.htm") ||
    lower.includes("please logon") ||
    lower.includes("anmelden")
  );
}

function isSSOPage(html: string, finalUrl?: string): boolean {
  const lower = html.toLowerCase();
  if (finalUrl) {
    const urlLower = finalUrl.toLowerCase();
    if (
      urlLower.includes("accounts.sap.com") ||
      urlLower.includes("authserver") ||
      urlLower.includes("identity.authentication") ||
      urlLower.includes("ias.") ||
      urlLower.includes("idp.")
    ) {
      return true;
    }
  }
  return (
    lower.includes("accounts.sap.com") ||
    lower.includes("sap identity authentication") ||
    lower.includes("sap universal id") ||
    lower.includes("oauth2/authorize") ||
    lower.includes("saml") ||
    (lower.includes("openid") && lower.includes("connect"))
  );
}

function isErrorResponse(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes("authentication failed") ||
    lower.includes("invalid credentials") ||
    lower.includes("password incorrect") ||
    lower.includes("logon failed") ||
    lower.includes("authorization check failed") ||
    lower.includes("incorrect user name or password") ||
    lower.includes("error during logon") ||
    lower.includes("http 401") ||
    lower.includes("http 403")
  );
}

export async function pingServer(baseUrl: string): Promise<{
  reachable: boolean;
  requiresSSO: boolean;
  statusCode: number;
  durationMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(`${baseUrl}?sap-client=100`, {
      method: "GET",
      headers: browserHeaders(),
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    const finalUrl = res.url || baseUrl;
    const requiresSSO = isSSOPage(text, finalUrl);
    return {
      reachable: true,
      requiresSSO,
      statusCode: res.status,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      reachable: false,
      requiresSSO: false,
      statusCode: 0,
      durationMs: Date.now() - start,
      error: err.message,
    };
  }
}

export async function createSapSession(
  sessionId: string,
  params: {
    baseUrl: string;
    client: string;
    username: string;
    password: string;
    language?: string;
  },
): Promise<SapSession> {
  const { baseUrl, client, username, password, language = "EN" } = params;

  logger.info(
    { sessionId, username, client },
    "Attempting SAP authentication",
  );

  const loginUrl = `${baseUrl}?sap-client=${encodeURIComponent(client)}&sap-language=${encodeURIComponent(language)}`;
  let cookies: SapCookies = {};

  const {
    text: loginHtml,
    newCookies: loginCookies,
    finalUrl: loginFinalUrl,
  } = await sapFetch(loginUrl, { method: "GET" });

  cookies = mergeCookies(cookies, loginCookies);

  if (isSSOPage(loginHtml, loginFinalUrl)) {
    logger.warn({ sessionId, finalUrl: loginFinalUrl }, "SAP redirected to SSO/IAS");
    throw new SapError(
      "SSO_REQUIRED",
      "This SAP tenant requires SSO (Identity Authentication Service). Standard username/password login is not supported — contact your SAP administrator to enable ITS form-based authentication.",
    );
  }

  if (!isLoginPage(loginHtml, loginFinalUrl)) {
    logger.warn(
      { sessionId, status: loginHtml.length },
      "SAP login page fields not detected — proceeding anyway",
    );
  }

  const hiddenFields = extractFormFields(loginHtml);
  const formAction = extractFormAction(loginHtml, baseUrl);

  const body = new URLSearchParams({
    "sap-user": username,
    "sap-password": password,
    "sap-client": client,
    "sap-language": language,
    SUBMIT: "",
    ...hiddenFields,
  });

  const {
    response: authResponse,
    text: authHtml,
    newCookies: authCookies,
    finalUrl: authFinalUrl,
  } = await sapFetch(formAction, {
    method: "POST",
    cookies,
    referer: loginUrl,
    body: body.toString(),
  });

  cookies = mergeCookies(cookies, authCookies);

  if (isSSOPage(authHtml, authFinalUrl)) {
    throw new SapError(
      "SSO_REQUIRED",
      "This SAP tenant redirected to SSO after login. Standard form-based authentication is not supported. Contact your SAP administrator.",
    );
  }

  if (
    isLoginPage(authHtml, authFinalUrl) ||
    isErrorResponse(authHtml) ||
    authResponse.status === 401 ||
    authResponse.status === 403
  ) {
    const messages = extractSapMessages(authHtml);
    throw new SapError(
      "AUTH_FAILED",
      messages.length
        ? messages[0]
        : "Authentication failed. Please check your SAP username and password.",
    );
  }

  const session: SapSession = {
    id: sessionId,
    cookies,
    baseUrl,
    client,
    username,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    authenticated: true,
  };

  sessionStore.set(sessionId, session);
  logger.info({ sessionId, username, authFinalUrl }, "SAP session created");
  return session;
}

export async function submitWarehouseSession(
  sessionId: string,
  params: {
    warehouseNo: string;
    resource: string;
    presDevice?: string;
    transactionCode?: string;
  },
): Promise<SapActionResult> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    throw new SapError("SESSION_EXPIRED", "Session expired. Please log in again.");
  }

  session.lastActivity = Date.now();
  const { warehouseNo, resource, presDevice = "", transactionCode = "" } = params;

  const txParam = transactionCode
    ? `&~transaction=${encodeURIComponent(transactionCode)}`
    : "";
  const txUrl = `${session.baseUrl}?sap-client=${session.client}&sap-language=EN${txParam}`;

  const { text: txHtml, newCookies, finalUrl: txFinalUrl } = await sapFetch(txUrl, {
    method: "GET",
    cookies: session.cookies,
    referer: session.baseUrl,
  });

  session.cookies = mergeCookies(session.cookies, newCookies);

  if (isLoginPage(txHtml, txFinalUrl) || isSSOPage(txHtml, txFinalUrl)) {
    sessionStore.delete(sessionId);
    throw new SapError("SESSION_EXPIRED", "SAP session expired. Please log in again.");
  }

  const hiddenFields = extractFormFields(txHtml);
  const formAction = extractFormAction(txHtml, session.baseUrl);

  const fieldNames: Record<string, string> = {};
  const $ = cheerio.load(txHtml);
  $("input[type='text'], input:not([type])").each((_, el) => {
    const name = $(el).attr("name") ?? "";
    const id = $(el).attr("id") ?? "";
    const nameUpper = name.toUpperCase();
    const idUpper = id.toUpperCase();
    if (nameUpper.includes("LGNUM") || idUpper.includes("LGNUM")) {
      fieldNames["warehouseField"] = name || id;
    }
    if (nameUpper.includes("RSRC") || idUpper.includes("RSRC")) {
      fieldNames["resourceField"] = name || id;
    }
    if (nameUpper.includes("PDEVICE") || idUpper.includes("PDEVICE")) {
      fieldNames["presDeviceField"] = name || id;
    }
  });

  const formBody = new URLSearchParams({
    ...(fieldNames["warehouseField"]
      ? { [fieldNames["warehouseField"]]: warehouseNo }
      : { LGNUM: warehouseNo }),
    ...(fieldNames["resourceField"]
      ? { [fieldNames["resourceField"]]: resource }
      : { RSRC: resource }),
    ...(fieldNames["presDeviceField"]
      ? { [fieldNames["presDeviceField"]]: presDevice }
      : { PDEVICE: presDevice }),
    "~OkCode": "F2",
    ...hiddenFields,
  });

  const {
    text: resultHtml,
    newCookies: resultCookies,
    response: resultResponse,
  } = await sapFetch(formAction, {
    method: "POST",
    cookies: session.cookies,
    referer: txUrl,
    body: formBody.toString(),
  });

  session.cookies = mergeCookies(session.cookies, resultCookies);
  session.warehouseNo = warehouseNo;
  session.resource = resource;
  session.presDevice = presDevice;

  if (isLoginPage(resultHtml) || isSSOPage(resultHtml)) {
    sessionStore.delete(sessionId);
    throw new SapError("SESSION_EXPIRED", "SAP session expired. Please log in again.");
  }

  const sapMessages = extractSapMessages(resultHtml);
  const hasError =
    sapMessages.some(
      (m) =>
        m.toLowerCase().includes("error") ||
        m.toLowerCase().includes("not found") ||
        m.toLowerCase().includes("invalid") ||
        m.toLowerCase().includes("does not exist"),
    ) || resultResponse.status >= 400;

  const nextHiddenFields = extractFormFields(resultHtml);

  logger.info(
    { sessionId, warehouseNo, resource, messages: sapMessages },
    "Warehouse session submitted",
  );

  return {
    success: !hasError,
    sapMessages,
    message: hasError
      ? sapMessages[0] ?? "SAP returned an error. Check warehouse configuration."
      : sapMessages[0] ?? "Connected successfully",
    formFields: nextHiddenFields,
    nextScreen: hasError ? undefined : "dashboard",
  };
}

export async function submitSapAction(
  sessionId: string,
  okCode: string,
  extraFields?: Record<string, string>,
): Promise<SapActionResult> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    throw new SapError("SESSION_EXPIRED", "Session expired. Please log in again.");
  }

  session.lastActivity = Date.now();

  const { text: currentHtml, newCookies: navCookies, finalUrl } = await sapFetch(
    `${session.baseUrl}?sap-client=${session.client}`,
    { method: "GET", cookies: session.cookies, referer: session.baseUrl },
  );
  session.cookies = mergeCookies(session.cookies, navCookies);

  if (isLoginPage(currentHtml, finalUrl) || isSSOPage(currentHtml, finalUrl)) {
    sessionStore.delete(sessionId);
    throw new SapError("SESSION_EXPIRED", "SAP session expired. Please log in again.");
  }

  const hiddenFields = extractFormFields(currentHtml);
  const formAction = extractFormAction(currentHtml, session.baseUrl);

  const body = new URLSearchParams({
    "~OkCode": okCode,
    ...hiddenFields,
    ...extraFields,
  });

  const { text: resultHtml, newCookies: resultCookies } = await sapFetch(
    formAction,
    {
      method: "POST",
      cookies: session.cookies,
      referer: `${session.baseUrl}?sap-client=${session.client}`,
      body: body.toString(),
    },
  );

  session.cookies = mergeCookies(session.cookies, resultCookies);
  const sapMessages = extractSapMessages(resultHtml);

  return {
    success: true,
    sapMessages,
    formFields: extractFormFields(resultHtml),
  };
}

export function getSession(sessionId: string): SapSession | undefined {
  const session = sessionStore.get(sessionId);
  if (session) session.lastActivity = Date.now();
  return session;
}

export function destroySession(sessionId: string): void {
  sessionStore.delete(sessionId);
  logger.info({ sessionId }, "SAP session destroyed");
}

export function getSessionCount(): number {
  return sessionStore.size;
}
