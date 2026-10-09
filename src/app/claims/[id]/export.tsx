import * as Clipboard from "expo-clipboard";
import { type Href, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { ErrorNote, Header, PrimaryButton, Screen } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { colors } from "@/theme";

export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useBundle(id);
  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <Screen>
        <Header title="Export" back={`/claims/${id}` as Href} />
        <ErrorNote message={error} />
      </Screen>
    );
  }
  if (loading || !data) {
    return (
      <Screen>
        <Header title="Export" back={`/claims/${id}` as Href} />
        <Text style={styles.note}>Building the file…</Text>
      </Screen>
    );
  }

  const live = data.photos.filter((photo) => !photo.deletedAt);
  const report = [
    data.claim.claimNumber,
    data.claim.insuredName,
    data.claim.riskAddress,
    data.claim.carrier,
    "",
    ...live.map((photo) => `${photo.chip} — ${photo.caption}`),
    "",
    ...data.deficiencies.issues.map((issue) => `Missing: ${issue.text}`),
  ].join("\n");

  return (
    <Screen>
      <Header title="Export" sub={data.claim.claimNumber} back={`/claims/${id}` as Href} />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.note}>
          {live.length} photos · {data.rooms.length} rooms · {data.deficiencies.issues.length} open items. ZIP packaging stays on the web app for now. This copy is the field summary.
        </Text>
        <Text style={styles.report}>{report}</Text>
        <PrimaryButton
          label={copied ? "Copied" : "Copy summary"}
          onPress={async () => {
            await Clipboard.setStringAsync(report);
            setCopied(true);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 14 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  report: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, color: colors.ink, lineHeight: 20 },
});
