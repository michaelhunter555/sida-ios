import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ClaimPill, ErrorNote, Header, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Claim, ClaimType } from "@/lib/types";
import { colors } from "@/theme";
import { useAuth } from "@/context/user-context";
import { Avatar } from "react-native-paper";

interface ClaimCard extends Claim {
  photoCount: number;
}

/** Stand-in colors for the card dot until sync status drives it. */
const DOT_COLORS = ["#1E8E3E", "#E87722", "#8a94a6", "#2d5fb5", "#b53030", "#5f3fb0"];
const dotColorByClaim = new Map<string, string>();

function dotColor(claimId: string) {
  const existing = dotColorByClaim.get(claimId);
  if (existing) return existing;
  const next = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];
  dotColorByClaim.set(claimId, next);
  return next;
}

export default function ClaimsHome() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api<ClaimCard[]>("/api/claims")
        .then((rows) => {
          if (active) setClaims(rows);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Could not load claims");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen>
      <Header title="Claims" right={user?.imagePath ? <Avatar.Image source={{ uri: user.imagePath }} size={36} /> : <Text style={styles.avatar}>{user?.name?.charAt(0).toUpperCase() || "U"}</Text>} />
      {error ? <ErrorNote message={error} /> : null}
      <ScrollView contentContainerStyle={styles.list}>
        <PrimaryButton label="+ New Claim" onPress={() => router.push("/claims/new" as Href)} />
        {claims.map((claim) => (
          <Pressable key={claim.id} style={styles.card} onPress={() => router.push(`/claims/${claim.id}` as Href)}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text style={styles.number}>{claim.claimNumber}</Text>
                <Text style={styles.meta}>
                  {claim.insuredName}
                  {"\n"}
                  {claim.riskAddress}
                </Text>
              </View>
              <View>
              <ClaimPill type={claim.claimType as ClaimType} />
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.meta}>
                {claim.photoCount} photos · {claim.inspectionCount} inspection{claim.inspectionCount === 1 ? "" : "s"}
              </Text>
              <View style={styles.footerRight}>
                <Text style={styles.meta}>{timeAgo(claim.updatedAt)}</Text>
                <View style={[styles.dot, { backgroundColor: dotColor(claim.id) }]} />
              </View>
            </View>
          </Pressable>
        ))}
        {!error && loading ? <Text style={styles.meta}>Loading claims…</Text> : null}
        {!error && !loading && claims.length === 0 ? <Text style={styles.meta}>No claims yet.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 18, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  grow: { flex: 1 },
  number: { fontSize: 16, fontWeight: "700", color: colors.ink },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.line,
    textAlign: "center",
    lineHeight: 36,
    fontWeight: "700",
    color: colors.navy,
  },
});
