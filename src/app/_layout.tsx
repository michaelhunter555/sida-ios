import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ToastProvider } from "react-native-toast-notifications";
import { SocketEventListener } from "@/components/socket-event-listener";
import { SocketProvider } from "@/context/socket-context";
import { AuthProvider, useAuth } from "@/context/user-context";
import { colors } from "@/theme";
import * as Notifications from 'expo-notifications';
import { PushNotificationProvider } from '@/context/push-notifications';
import { queryClient } from "@/lib/query-client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

type UpdatesModule = typeof import("expo-updates");

/** Lazy load so older binaries without ExpoUpdates native module still boot. */
function getUpdatesModule(): UpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-updates") as UpdatesModule;
  } catch {
    return null;
  }
}

export function useOTAUpdates() {
  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === "web") return;

    const Updates = getUpdatesModule();
    if (!Updates?.isEnabled) return;

    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return;

      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (err) {
      console.warn("[OTA] Update check failed:", err);
    }
  }, []);

  useEffect(() => {
    checkForUpdate();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkForUpdate();
      }
    });

    return () => sub.remove();
  }, [checkForUpdate]);

  return { checkForUpdate };
}

function SessionSplash() {
  const { ready } = useAuth();
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
  }, []);
  useOTAUpdates();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  return null;
}

function RootNavigator() {
  const { ready, accessToken } = useAuth();
  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!!accessToken}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="claims" />
      </Stack.Protected>
      <Stack.Protected guard={!accessToken}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <ToastProvider offsetTop={56} duration={3500} successColor={colors.green} dangerColor={colors.red}>
          <AuthProvider>
            <SocketProvider>
              <PushNotificationProvider>
                <SessionSplash />
                <SocketEventListener />
                <RootNavigator />
              </PushNotificationProvider>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}
