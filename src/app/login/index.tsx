import * as AppleAuthentication from "expo-apple-authentication";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "react-native-paper";
import { ErrorNote, Screen } from "@/components/ui";
import { useAuth } from "@/context/user-context";
import { colors } from "@/theme";

export default function LoginScreen() {
  const { signInAsGuest, signInWithApple, signInWithGoogle, guestIsSigningIn, isSigningIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const busy = guestIsSigningIn || isSigningIn;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    }
  }

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.copy}>
          <Text style={styles.brand}>Sida</Text>
          <Text style={styles.sub}>Sign in to open the field file.</Text>
        </View>
        {error ? <ErrorNote message={error} /> : null}
        <Pressable style={[styles.guest, busy && styles.disabled]} disabled={busy} onPress={() => run(signInAsGuest)}>
          <Text style={styles.guestText}>{guestIsSigningIn ? "Starting…" : "Continue as guest"}</Text>
        </Pressable>
        {Platform.OS === "ios" ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={[styles.apple, busy && styles.disabled]}
            onPress={() => run(signInWithApple)}
          />
        ) : null}
        <Pressable style={[styles.google, busy && styles.disabled]} disabled={busy} onPress={() => run(signInWithGoogle)}>
          <Icon source="google" size={20} color={colors.ink} />
          <Text style={styles.googleText}>{isSigningIn ? "Working…" : "Continue with Google"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "flex-end", padding: 24, gap: 12, paddingBottom: 36 },
  copy: { marginBottom: 12, gap: 6 },
  brand: { fontSize: 40, fontWeight: "700", color: colors.navy, letterSpacing: -1 },
  sub: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  guest: { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  guestText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  apple: { width: "100%", height: 52 },
  google: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  googleText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.55 },
});
