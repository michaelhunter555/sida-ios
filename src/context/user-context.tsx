import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { getCalendars, getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { API_URL } from "@/lib/api";

interface IUser {
  id: string;
  name: string;
  email: string;
  appleId: string;
  googleId: string;
  imagePath: string;
  isGuest: boolean;
  loginMethod: string;
  claims: string[];
  emailVerified: boolean;
  pushToken: string;
  timeZone: string;
  membershipPlan: string;
  trialStartDate: string;
  trialEndDate: string;
  lastChargeDate: string;
  nextChargeDate: string;
  updatedAt: string;
  token?: string;
  accessToken?: string;
}

interface IUserContext {
  user: Partial<IUser> | null;
  accessToken?: string | null;
  ready: boolean;
  isLoggedIn: boolean;
  signInAsGuest: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: Partial<IUser>) => Promise<void>;
  isSigningIn: boolean;
  guestIsSigningIn: boolean;
}

export const AuthContext = createContext<IUserContext>({
  user: null,
  accessToken: null,
  ready: false,
  isLoggedIn: false,
  signInAsGuest: async () => {},
  signInWithApple: async () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
  isSigningIn: false,
  guestIsSigningIn: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isStoredGuestUser(value: unknown): value is Partial<IUser> {
  return Boolean(value && typeof value === "object" && "isGuest" in value && (value as { isGuest?: boolean }).isGuest);
}

async function storeSession(userData: Partial<IUser>, token: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    ["@token", token],
    ["@refreshToken", refreshToken],
    ["@user", JSON.stringify(userData)],
  ]);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<Partial<IUser> | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [guestIsSigningIn, setGuestIsSigningIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const userAuthRef = useRef<Partial<IUser> | null | undefined>(undefined);

  const timeZone = getCalendars()?.[0]?.timeZone ?? "America/New_York";
  const deviceLanguageCode = getLocales()?.[0]?.languageCode ?? "en";

  useEffect(() => {
    userAuthRef.current = authUser;
  }, [authUser]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!webClientId) return;
    GoogleSignin.configure({
      webClientId,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  useEffect(() => {
    async function restore() {
      try {
        const storedToken = await AsyncStorage.getItem("@token");
        const storedUser = await AsyncStorage.getItem("@user");
        if (!storedToken || !storedUser) {
          setAuthUser(null);
          setAccessToken(null);
          return;
        }
        setAuthUser(JSON.parse(storedUser) as Partial<IUser>);
        setAccessToken(storedToken);
      } catch {
        setAuthUser(null);
        setAccessToken(null);
      } finally {
        setReady(true);
      }
    }
    restore();
  }, []);

  async function handleAppleSignIn() {
    if (Platform.OS !== "ios") {
      console.warn("Apple Sign In is only available on iOS devices.");
      return;
    }

    try {
      const rawNonce = randomNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: rawNonce,
      });
      if (!credential.identityToken) throw new Error("No identity token");

      const body: Record<string, string> = {
        idToken: credential.identityToken,
        rawNonce,
        timeZone,
        provider: "apple",
        localLanguageCode: deviceLanguageCode,
      };
      if (credential.fullName?.givenName) body.givenName = credential.fullName.givenName;
      if (credential.fullName?.familyName) body.familyName = credential.fullName.familyName;
      if (credential.email) body.email = credential.email;

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Could not sign in with Apple");

      const userData = { ...data.userData, token: data.token, accessToken: data.token };
      setAuthUser(userData);
      setAccessToken(data.token);
      await storeSession(userData, data.token, data.refreshToken);
      // if (typeof userData.email === "string" && userData.email.trim()) {
      //   try {
      //     await Purchases.logIn(userData.email.trim());
      //   } catch (err) {
      //     console.warn("[RevenueCat] logIn failed", err);
      //   }
      // }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn("Apple Sign-In Error", message);
      throw err instanceof Error ? err : new Error(message);
    }
  }

  async function handleGoogleSignIn() {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (!isSuccessResponse(userInfo)) return;

      const tokens = await GoogleSignin.getTokens();
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
          idToken: tokens?.idToken,
          provider: "google",
          timeZone,
          localLanguageCode: deviceLanguageCode,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "Could not sign in with Google");

      const userData = { ...data.userData, token: data.token, accessToken: data.token };
      setAuthUser(userData);
      setAccessToken(data.token);
      await storeSession(userData, data.token, data.refreshToken);
      // if (typeof userData.email === "string" && userData.email.trim()) {
      //   try {
      //     await Purchases.logIn(userData.email.trim());
      //   } catch (err) {
      //     console.warn("[RevenueCat] logIn failed", err);
      //   }
      // }
    } catch (error: unknown) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === statusCodes.SIGN_IN_CANCELLED || code === "-5") return;
      console.warn("Sign-in error:", error);
      setAuthUser(null);
      setAccessToken(null);
      throw error instanceof Error ? error : new Error("Could not sign in with Google");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleSignOut() {
    try {
      const authToken = await AsyncStorage.getItem("@token");
      const stored = authUser?.id ? authUser : JSON.parse((await AsyncStorage.getItem("@user")) || "null");
      const userId = stored?.id ?? "";
      if (authToken && userId) {
        await fetch(`${API_URL}/auth/logout/${encodeURIComponent(userId)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
      // if (!authUser?.isGuest) {
      //   try {
      //     await Purchases.logOut();
      //   } catch (rcErr) {
      //     console.warn("[RevenueCat] logOut", rcErr);
      //   }
      // }
      await AsyncStorage.multiRemove(["@user", "@token", "@refreshToken"]);
      setAuthUser(null);
      setAccessToken(null);
    } catch (error) {
      console.warn("Error signing out:", error);
      // if (!authUser?.isGuest) {
      //   try {
      //     await Purchases.logOut();
      //   } catch (rcErr) {
      //     console.warn("[RevenueCat] logOut", rcErr);
      //   }
      // }
      await AsyncStorage.multiRemove(["@user", "@token", "@refreshToken"]);
      setAuthUser(null);
      setAccessToken(null);
    }
  }

  async function handleGuestLogin() {
    setGuestIsSigningIn(true);
    try {
      const checkUser = await AsyncStorage.getItem("@user");
      const storedToken = await AsyncStorage.getItem("@token");
      if (checkUser && storedToken) {
        const parsed = JSON.parse(checkUser) as unknown;
        if (isStoredGuestUser(parsed)) {
          setAuthUser(parsed);
          setAccessToken(storedToken);
          return;
        }
      }
      const guestId = await AsyncStorage.getItem("@guestId");
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
          ...(guestId ? { localGuestId: guestId } : {}),
          provider: "guest",
          timeZone,
          localLanguageCode: deviceLanguageCode,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.error || !data.ok) throw new Error(data.error || "Could not sign in as a guest");

      const userData = { ...data.userData, token: data.token, accessToken: data.token };
      setAuthUser(userData);
      setAccessToken(data.token);
      const guestIdToStore = typeof userData?.email === "string" ? userData.email : "";
      await AsyncStorage.multiSet([
        ["@token", data.token],
        ["@refreshToken", data.refreshToken],
        ["@user", JSON.stringify(userData)],
        ["@guestId", guestIdToStore],
      ]);
      // if (typeof userData.email === "string" && userData.email.trim()) {
      //   try {
      //     await Purchases.logIn(userData.email.trim());
      //   } catch (err) {
      //     console.warn("[RevenueCat] logIn failed", err);
      //   }
      // }
    } catch (err) {
      console.warn("Error handling guest login:", err);
      setAuthUser(null);
      setAccessToken(null);
      throw err instanceof Error ? err : new Error("Could not sign in as a guest");
    } finally {
      setGuestIsSigningIn(false);
    }
  }

  async function handleManualCredentials(email: string, password: string, name?: string) {
    setIsSigningIn(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: JSON.stringify({
          localLanguageCode: deviceLanguageCode,
          timeZone,
          email,
          password,
          ...(name ? { name, isNewManualSignUp: true } : {}),
          provider: "email",
        }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (data.error || !data.ok) throw new Error(data.error || "Could not sign in");

      const userData = { ...data.userData, token: data.token, accessToken: data.token };
      setAuthUser(userData);
      setAccessToken(data.token);
      await storeSession(userData, data.token, data.refreshToken);
      // if (typeof userData.email === "string" && userData.email.trim()) {
      //   try {
      //     await Purchases.logIn(userData.email.trim());
      //   } catch (err) {
      //     console.warn("[RevenueCat] logIn failed", err);
      //   }
      // }
    } catch (err) {
      setAuthUser(null);
      setAccessToken(null);
      throw err instanceof Error ? err : new Error("Could not sign in");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function updateUser(next: Partial<IUser>) {
    const updated = { ...(authUser ?? {}), ...next };
    setAuthUser(updated);
    await AsyncStorage.setItem("@user", JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider
      value={{
        user: authUser,
        accessToken,
        ready,
        isLoggedIn: !!accessToken,
        signInWithApple: handleAppleSignIn,
        signInWithGoogle: handleGoogleSignIn,
        signOut: handleSignOut,
        updateUser,
        signInAsGuest: handleGuestLogin,
        signInWithEmail: handleManualCredentials,
        isSigningIn,
        guestIsSigningIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
