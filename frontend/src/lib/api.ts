/**
 * Thin typed client for the Azula Code Node backend.
 * Base URL comes from VITE_API_URL; defaults to the local backend port.
 */

export const API_BASE =
  (import.meta.env['VITE_API_URL'] as string | undefined)?.trim().replace(/\/+$/, "") ||
  "https://8001-df4cd476-1291-456c-bda1-a225ed886904.proxy.daytona.work";

const TOKEN_KEY = "azula.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal | undefined } = {},
): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: options.signal ?? AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError("Cannot reach the server. Check your connection or try again shortly.", 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data as { error?: string; message?: string } | null)?.error ??
      (data as { message?: string } | null)?.message ??
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }
  if (text && !res.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError("The server returned an unexpected response. Please try again.", res.status);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  avatar_url: string | null;
  bio: string | null;
  plan: string;
  referral_code: string;
  credits: number;
  created_at: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  type: "file" | "dir";
  size?: number;
}

export interface ModelRecord {
  id: number;
  provider: string;
  model_id: string;
  label: string;
  context_window: number;
  enabled: boolean;
}

export interface PlanRecord {
  id: number;
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  interval: string;
  features: string[];
  highlighted: boolean;
  enabled: boolean;
}
