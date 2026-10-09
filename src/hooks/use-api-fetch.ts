import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback } from "react";
import { useAuth } from "@/context/user-context";
import { API_URL } from "@/lib/api";

type Methods = "GET" | "POST" | "PUT" | "DELETE";

let refreshInFlight: Promise<boolean> | null = null;

export const useApiFetch = () => {
  const auth = useAuth();

  const apiFetch = useCallback(
    async (path: string, method: Methods = "GET", body?: BodyInit | null, options: RequestInit = {}) => {
      const token = await AsyncStorage.getItem("@token");

      try {
        const res = await fetch(`${API_URL}${path}`, {
          method,
          body,
          headers: {
            ...(options.headers || {}),
            Authorization: token ? `Bearer ${token}` : "",
            ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
          },
        });
        const data = await res.json();

        if (data.error !== "EXPIRED_TOKEN") {
          return data;
        }

        const didRefresh = await tryRefresh();
        if (!didRefresh) {
          await AsyncStorage.multiRemove(["@user", "@token", "@refreshToken"]);
          await auth?.signOut();
          return data;
        }

        const newToken = await AsyncStorage.getItem("@token");
        const retryRes = await fetch(`${API_URL}${path}`, {
          method,
          body,
          headers: {
            ...(options.headers || {}),
            Authorization: newToken ? `Bearer ${newToken}` : "",
            ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
          },
        });
        const retryData = await retryRes.json();
        if (!retryRes.ok && retryData.action === "logout") {
          await auth?.signOut();
        }
        return retryData;
      } catch (err) {
        console.warn(err);
        throw err;
      }
    },
    [auth],
  );

  async function tryRefresh() {
    if (!refreshInFlight) {
      refreshInFlight = refreshOnce().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;

    async function refreshOnce() {
      const refreshToken = await AsyncStorage.getItem("@refreshToken");
      if (!refreshToken) return false;

      let userId = auth?.user?.id;
      if (!userId) {
        try {
          const raw = await AsyncStorage.getItem("@user");
          if (raw) {
            const parsed = JSON.parse(raw) as { id?: string };
            userId = parsed.id;
          }
        } catch {
          /* ignore */
        }
      }
      if (!userId) return false;

      const res = await fetch(`${API_URL}/auth/refresh/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (!data?.token) return false;
      await AsyncStorage.setItem("@token", data.token);
      if (typeof data.refreshToken === "string" && data.refreshToken) {
        await AsyncStorage.setItem("@refreshToken", data.refreshToken);
      }
      await auth?.updateUser({ token: data.token, accessToken: data.token });
      return true;
    }
  }

  return { apiFetch };
};
