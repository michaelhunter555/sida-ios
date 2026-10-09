import { type Href, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Header, Screen } from "@/components/ui";
import { WORKFLOW } from "@/lib/matrix";
import { colors } from "@/theme";

export default function WorkflowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Header title="Workflow" back={`/claims/${id}` as Href} />
      <ScrollView contentContainerStyle={styles.page}>
        {WORKFLOW.map((step) => (
          <View key={step.n} style={styles.card}>
            <Text style={styles.n}>{step.n}</Text>
            <View style={styles.body}>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.meta}>{step.meta}</Text>
              <Text style={styles.desc}>{step.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 12 },
  card: { flexDirection: "row", gap: 12, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  n: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: colors.orange, color: colors.white, textAlign: "center", lineHeight: 28, fontWeight: "700" },
  body: { flex: 1, gap: 4 },
  title: { fontWeight: "700", fontSize: 16, color: colors.ink },
  meta: { color: colors.orange, fontSize: 12, fontWeight: "700" },
  desc: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
