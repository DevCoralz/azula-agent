/**
 * Thin typed client for the Azula Code Node backend.
 * Base URL comes from VITE_API_URL; defaults to the local backend port.
 */

export const API_BASE =
  (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

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
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
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
