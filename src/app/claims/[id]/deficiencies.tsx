import { type Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "react-native-paper";
import { ErrorNote, Header, Screen } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { api } from "@/lib/api";
import { DOCUMENT_EMAIL } from "@/lib/matrix";
import type { Issue, Limitation } from "@/lib/types";
import { colors } from "@/theme";

const GROUPS: { id: Issue["group"]; title: string }[] = [
  { id: "hard", title: "Hard requirements" },
  { id: "photos", title: "Missing photos" },
  { id: "water", title: "Missing water documentation" },
  { id: "roof", title: "Missing roof documentation" },
  { id: "documents", title: "Document requests pending" },
];

export default function DeficienciesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useBundle(id);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ key: string; message: string } | null>(null);

  if (error) {
    return (
      <Screen>
        <Header title="Deficiency check" back={`/claims/${id}` as Href} />
        <ErrorNote message={error} />
      </Screen>
    );
  }
  if (loading || !data) {
    return (
      <Screen>
        <Header title="Deficiency check" back={`/claims/${id}` as Href} />
        <Text style={styles.note}>Checking the file…</Text>
      </Screen>
    );
  }

  const issues = data.deficiencies.issues;

  async function markRequested(docId: string) {
    await api(`/api/documents/${docId}`, { method: "PATCH", body: JSON.stringify({ requested: true }) });
    await Linking.openURL(`mailto:${DOCUMENT_EMAIL}?subject=${encodeURIComponent(data!.claim.claimNumber)}`);
    await reload();
  }

  async function saveLimitation(issue: Issue) {
    const reason = (drafts[issue.key] ?? "").trim();
    if (!reason || savingKey) return;
    setSavingKey(issue.key);
    setSaveError(null);
    try {
      await api(`/api/claims/${id}/limitations`, {
        method: "POST",
        body: JSON.stringify({ key: issue.key, reason, label: issue.text }),
      });
      setDrafts(({ [issue.key]: _saved, ...rest }) => rest);
      setOpenKey(null);
      await reload();
    } catch (err) {
      setSaveError({ key: issue.key, message: err instanceof Error ? err.message : "Could not save the limitation" });
    } finally {
      setSavingKey(null);
    }
  }

  function editLimitation(item: Limitation) {
    setEditingId(editingId === item.id ? null : item.id);
    setDrafts((prev) => (item.id in prev ? prev : { ...prev, [item.id]: item.reason }));
  }

  async function updateLimitation(item: Limitation) {
    const reason = (drafts[item.id] ?? "").trim();
    if (!reason || savingKey) return;
    setSavingKey(item.id);
    setSaveError(null);
    try {
      await api(`/api/limitations/${item.id}`, { method: "PATCH", body: JSON.stringify({ reason }) });
      setDrafts(({ [item.id]: _saved, ...rest }) => rest);
      setEditingId(null);
      await reload();
    } catch (err) {
      setSaveError({ key: item.id, message: err instanceof Error ? err.message : "Could not save the limitation" });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <Screen>
      <Header title="Deficiency check" sub={data.claim.claimNumber} back={`/claims/${id}` as Href} />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.banner}>
          {issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} before you leave` : "Nothing missing for this claim type"}
        </Text>
        {GROUPS.map((group) => {
          const rows = issues.filter((issue) => issue.group === group.id);
          if (!rows.length) return null;
          return (
            <View key={group.id} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {rows.map((issue) => {
                const docId = issue.key.startsWith("doc-") ? issue.key.slice(4) : null;
                return (
                  <View key={issue.key} style={styles.row}>
                    <Text style={styles.issue}>{issue.text}</Text>
                    <View style={styles.actions}>
                      <Pressable onPress={() => router.push(issue.href as Href)}>
                        <Text style={styles.link}>Open</Text>
                      </Pressable>
                      {docId ? (
                        <Pressable onPress={() => markRequested(docId)}>
                          <Text style={styles.link}>Request</Text>
                        </Pressable>
                      ) : (
                        <Pressable onPress={() => setOpenKey(openKey === issue.key ? null : issue.key)}>
                          <Text style={styles.link}>Limitation</Text>
                        </Pressable>
                      )}
                    </View>
                    {openKey === issue.key ? (
                      <View style={styles.reasonBox}>
                        <TextInput
                          key={issue.key}
                          style={styles.input}
                          value={drafts[issue.key] ?? ""}
                          placeholder="Why this cannot be captured"
                          placeholderTextColor={colors.ink}
                          onChangeText={(text) => setDrafts((prev) => ({ ...prev, [issue.key]: text }))}
                        />
                        {saveError?.key === issue.key ? <Text style={styles.error}>{saveError.message}</Text> : null}
                        <Pressable
                          onPress={() => saveLimitation(issue)}
                          disabled={!(drafts[issue.key] ?? "").trim() || savingKey === issue.key}
                        >
                          <Text style={[styles.link, !(drafts[issue.key] ?? "").trim() && styles.linkOff]}>
                            {savingKey === issue.key ? "Saving…" : "Save limitation"}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}
        {data.limitations.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Limitations logged</Text>
            {data.limitations.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.loggedHead}>
                  <Text style={[styles.issue, styles.loggedTitle]}>{item.label || item.key}</Text>
                  <Pressable hitSlop={8} onPress={() => editLimitation(item)} accessibilityLabel="Edit limitation">
                    <Icon source="pencil" size={16} color={colors.orange} />
                  </Pressable>
                </View>
                {editingId === item.id ? (
                  <View style={styles.reasonBox}>
                    <TextInput
                      key={item.id}
                      style={styles.input}
                      value={drafts[item.id] ?? item.reason}
                      placeholder="Why this cannot be captured"
                      placeholderTextColor={colors.ink}
                      onChangeText={(text) => setDrafts((prev) => ({ ...prev, [item.id]: text }))}
                    />
                    {saveError?.key === item.id ? <Text style={styles.error}>{saveError.message}</Text> : null}
                    <Pressable
                      onPress={() => updateLimitation(item)}
                      disabled={!(drafts[item.id] ?? item.reason).trim() || savingKey === item.id}
                    >
                      <Text style={[styles.link, !(drafts[item.id] ?? item.reason).trim() && styles.linkOff]}>
                        {savingKey === item.id ? "Saving…" : "Save limitation"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.reason}>{item.reason}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
        {data.deficiencies.passing.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Passing</Text>
            {data.deficiencies.passing.map((item) => (
              <Text key={item} style={styles.pass}>
                {item}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 14, paddingBottom: 40 },
  banner: { backgroundColor: colors.navy, color: colors.white, borderRadius: 12, overflow: "hidden", padding: 16, fontWeight: "700" },
  group: { gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.muted },
  row: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  issue: { color: colors.ink, fontSize: 15 },
  actions: { flexDirection: "row", gap: 16 },
  link: { color: colors.orange, fontWeight: "700" },
  linkOff: { opacity: 0.4 },
  error: { color: colors.red, fontSize: 13 },
  loggedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  loggedTitle: { flex: 1 },
  reason: { color: colors.muted, fontSize: 14 },
  reasonBox: { gap: 8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, color: colors.ink },
  pass: { color: colors.green, fontSize: 14 },
  note: { padding: 18, color: colors.muted },
});
