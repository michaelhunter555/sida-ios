import { type Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { claimMeta } from "@/lib/matrix";
import type { ClaimType, SyncStatus } from "@/lib/types";
import { colors, pillColors } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function Header({
  status,
  title,
  sub,
  back,
  right,
}: {
  title: string;
  status?: SyncStatus;
  sub?: string;
  back?: Href;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {back ? (
          <Pressable onPress={() => router.push(back)} hitSlop={8}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {status ? <SyncPill status={status || "pending"} /> : null}
          </View>
          {sub ? (
            <Text style={styles.sub} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerSide}>{right}</View>
    </View>
  );
}

export function SyncPill({ status }: { status: SyncStatus }) {
  const label = status === "synced" ? "Synced" : status === "pending" ? "Pending" : "Local";
  return (
    <Text style={[styles.sync, status === "pending" && styles.syncPending, status === "local" && styles.syncLocal]}>
      {label}
    </Text>
  );
}

export function ClaimPill({ type }: { type: ClaimType }) {
  const meta = claimMeta(type);
  const tone = pillColors[meta.pill] ?? pillColors.neutral;
  return <Text style={[styles.pill, { backgroundColor: tone.bg, color: tone.fg }]}>{meta.label}</Text>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable style={[styles.primary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      {icon ? icon : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function Muted({ children }: { children: string }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerSide: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  headerText: { flexShrink: 1 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  back: { color: colors.orange, fontSize: 32, lineHeight: 34, width: 28 },
  sync: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.green,
    backgroundColor: "#e5f6ea",
    overflow: "hidden",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncPending: { color: "#8a4b08", backgroundColor: "#fff1e4" },
  syncLocal: { color: colors.muted, backgroundColor: colors.line },
  pill: {
    overflow: "hidden",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  error: { margin: 16, padding: 12, borderRadius: 12, backgroundColor: "#fde8e8" },
  errorText: { color: colors.red, fontSize: 13 },
  primary: { backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: "center",justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.55 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
