import { type Href, router } from "expo-router";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/context/user-context";
import { useApiFetch } from "@/hooks/use-api-fetch";

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  error: Error | null;
  requestPushToken: () => Promise<string | undefined>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const idleNotifications: NotificationContextType = {
  expoPushToken: null,
  notification: null,
  error: null,
  requestPushToken: async () => undefined,
};

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}

function notificationsAllowed(settings: Notifications.NotificationPermissionsStatus) {
  if (settings.granted || settings.status === "granted") return true;
  const iosStatus = settings.ios?.status;
  return (
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  if (Platform.OS === "web") {
    return <NotificationContext.Provider value={idleNotifications}>{children}</NotificationContext.Provider>;
  }
  return <NativePushNotifications>{children}</NativePushNotifications>;
}

function NativePushNotifications({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { apiFetch } = useApiFetch();
  const auth = useAuth();
  const userId = auth.user?.id;
  const authRef = useRef(auth);
  const apiFetchRef = useRef(apiFetch);
  authRef.current = auth;
  apiFetchRef.current = apiFetch;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);

  async function registerForPushNotificationsAsync() {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      let allowed = notificationsAllowed(existing);
      if (!allowed) {
        const requested = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        allowed = notificationsAllowed(requested);
      }
      if (!allowed) {
        console.warn("Notification permission was not granted.");
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error("Project ID not found");

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      setExpoPushToken(token);

      const id = authRef.current.user?.id;
      if (id && token) {
        const response = await apiFetchRef.current(
          `/auth/store-token/${encodeURIComponent(id)}`,
          "POST",
          JSON.stringify({ pushToken: token }),
        );
        if (response?.ok) {
          await authRef.current.updateUser({ pushToken: token });
        } else {
          console.warn("Failed to store push token:", response?.error);
        }
      }

      return token;
    } catch (err) {
      const next = err instanceof Error ? err : new Error("Could not register for push notifications");
      console.warn(next.message);
      setError(next);
    }
  }

  const registerRef = useRef(registerForPushNotificationsAsync);
  registerRef.current = registerForPushNotificationsAsync;

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((incoming) => {
      setNotification(incoming);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    const path = lastResponse.notification.request.content.data?.path;
    if (typeof path === "string" && path.length > 0) {
      router.push(path as Href);
    }
    Notifications.clearLastNotificationResponse();
  }, [lastResponse]);

  useEffect(() => {
    if (!userId) return;
    registerRef.current();
  }, [userId]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        error,
        requestPushToken: () => registerRef.current(),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
