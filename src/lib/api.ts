import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, UploadType } from "expo-file-system";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export function fileUrl(photoId: string) {
  return `${API_URL}/api/photos/${photoId}/file`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return request(path, init, true);
}

async function request<T>(path: string, init: RequestInit | undefined, allowRefresh: boolean): Promise<T> {
  const token = await AsyncStorage.getItem("@token");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network request failed";
    throw new Error(`Cannot reach the API at ${API_URL} (${reason}).`);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (allowRefresh && body?.error === "EXPIRED_TOKEN") {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, init, false);
  }
  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  return body as T;
}

/** Uploads a photo file as the raw request body. Metadata goes in the query string. */
export async function apiUpload<T>(path: string, fileUri: string, mimeType: string, fields: Record<string, string>): Promise<T> {
  return upload(path, fileUri, mimeType, fields, true);
}

async function upload<T>(
  path: string,
  fileUri: string,
  mimeType: string,
  fields: Record<string, string>,
  allowRefresh: boolean,
): Promise<T> {
  const token = await AsyncStorage.getItem("@token");
  const query = new URLSearchParams(fields).toString();
  let result: { body: string; status: number };
  try {
    result = await new File(fileUri).upload(`${API_URL}${path}${query ? `?${query}` : ""}`, {
      httpMethod: "POST",
      uploadType: UploadType.BINARY_CONTENT,
      mimeType,
      headers: {
        Accept: "application/json",
        "Content-Type": mimeType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network request failed";
    throw new Error(`Cannot reach the API at ${API_URL} (${reason}).`);
  }
  let body: { error?: string } | null = null;
  if (result.body) {
    try {
      body = JSON.parse(result.body) as { error?: string };
    } catch {
      throw new Error(`Request failed (${result.status})`);
    }
  }
  if (allowRefresh && body?.error === "EXPIRED_TOKEN") {
    const refreshed = await refreshSession();
    if (refreshed) return upload(path, fileUri, mimeType, fields, false);
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(body?.error || `Request failed (${result.status})`);
  }
  return body as T;
}

async function refreshSession() {
  const refreshToken = await AsyncStorage.getItem("@refreshToken");
  const rawUser = await AsyncStorage.getItem("@user");
  let userId = "";
  try {
    userId = rawUser ? (JSON.parse(rawUser) as { id?: string }).id || "" : "";
  } catch {
    userId = "";
  }
  if (!refreshToken || !userId) return false;

  const response = await fetch(`${API_URL}/auth/refresh/${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  if (!data?.token) return false;
  await AsyncStorage.setItem("@token", data.token);
  if (typeof data.refreshToken === "string" && data.refreshToken) {
    await AsyncStorage.setItem("@refreshToken", data.refreshToken);
  }
  return true;
}
