import { useEffect, useState } from "react";
import { Button, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ErrorNote, Header, Screen } from "@/components/ui";
import { useAuth } from "@/context/user-context";
import { useForm } from "@/hooks/use-form";
import type { Inputs } from "@/hooks/types";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { colors } from "@/theme";

const FIELDS = ["name", "license", "defaultCarrier", "iptc", "wifiSync", "cellSync", "voiceNotesInExport"] as const;

function inputsFrom(settings: Settings): Record<string, Inputs> {
  return {
    name: { value: settings.name, isValid: settings.name.trim().length > 0 },
    license: { value: settings.license, isValid: true },
    defaultCarrier: { value: settings.defaultCarrier, isValid: true },
    iptc: { value: settings.iptc, isValid: true },
    wifiSync: { value: settings.wifiSync, isValid: true },
    cellSync: { value: settings.cellSync, isValid: true },
    voiceNotesInExport: { value: settings.voiceNotesInExport, isValid: true },
  };
}

function textValue(inputs: Record<string, Inputs>, id: string) {
  const value = inputs[id]?.value;
  return typeof value === "string" ? value : "";
}

function boolValue(inputs: Record<string, Inputs>, id: string) {
  return inputs[id]?.value === true;
}

export default function SettingsScreen() {
  const { updateUser, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formState, inputHandler, setFormData] = useForm({}, false);

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((next) => {
        setSettings(next);
        setFormData(inputsFrom(next), next.name.trim().length > 0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, [setFormData]);

  const dirty = settings
    ? FIELDS.some((id) => formState.inputs[id]?.value !== inputsFrom(settings)[id].value)
    : false;
  const canSave = dirty && formState.isValid && !saving;

  async function save() {
    if (!canSave || !settings) return;
    setSaving(true);
    setError(null);
    const body = {
      name: textValue(formState.inputs, "name"),
      license: textValue(formState.inputs, "license"),
      defaultCarrier: textValue(formState.inputs, "defaultCarrier"),
      iptc: boolValue(formState.inputs, "iptc"),
      wifiSync: boolValue(formState.inputs, "wifiSync"),
      cellSync: boolValue(formState.inputs, "cellSync"),
      voiceNotesInExport: boolValue(formState.inputs, "voiceNotesInExport"),
    };
    try {
      const next = await api<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
      setSettings(next);
      setFormData(inputsFrom(next), next.name.trim().length > 0);
      if (body.name !== settings.name) await updateUser({ name: next.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Settings" />
      {error ? <ErrorNote message={error} /> : null}
      {settings ? (
        <>
          <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={styles.page} bottomOffset={24} keyboardShouldPersistTaps="handled">
            <Text style={styles.group}>Profile</Text>
            <Field
              label="Name"
              value={textValue(formState.inputs, "name")}
              onChange={(name) => inputHandler("name", name, name.trim().length > 0)}
            />
            <Field
              label="IA license"
              value={textValue(formState.inputs, "license")}
              onChange={(license) => inputHandler("license", license, true)}
            />
            <Field
              label="Default carrier"
              value={textValue(formState.inputs, "defaultCarrier")}
              onChange={(defaultCarrier) => inputHandler("defaultCarrier", defaultCarrier, true)}
            />
            <Text style={styles.group}>Storage</Text>
            <Row label="Storage used" value={`${settings.storageUsedGb} GB`} />
            <Row label="Soft-deleted photos" value={String(settings.softDeleted)} />
            <Text style={styles.group}>Export</Text>
            <Toggle label="Write IPTC headlines" value={boolValue(formState.inputs, "iptc")} onChange={(iptc) => inputHandler("iptc", iptc, true)} />
            <Toggle
              label="Voice transcripts in ZIP"
              value={boolValue(formState.inputs, "voiceNotesInExport")}
              onChange={(voiceNotesInExport) => inputHandler("voiceNotesInExport", voiceNotesInExport, true)}
            />
            <Text style={styles.group}>Sync</Text>
            <Toggle label="Wi-Fi sync" value={boolValue(formState.inputs, "wifiSync")} onChange={(wifiSync) => inputHandler("wifiSync", wifiSync, true)} />
            <Toggle label="Cellular sync" value={boolValue(formState.inputs, "cellSync")} onChange={(cellSync) => inputHandler("cellSync", cellSync, true)} />
            <Text style={styles.group}>About</Text>
            <Row label="Version" value="1.0.0" />
            <Text style={styles.note}>
              Rough Expo port of the field inspection app. V1 claim types stay the same: plumbing, roof leak, wind/hail, fire, vandalism, and tree impact.
            </Text>
            <Pressable style={styles.signOut} onPress={() => signOut()}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          <View style={styles.saveBar}>
            <Button
              title={saving ? "Saving…" : "Save"}
              onPress={save}
              disabled={!canSave}
              color={Platform.OS === "ios" ? "#007AFF" : colors.orange}
            />
          </View>
          </KeyboardAwareScrollView>
        </>
      ) : null}
    </Screen>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} placeholderTextColor={colors.ink} onChangeText={onChange} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.orange, false: colors.line }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  page: { paddingBottom: 16 },
  group: {
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 18,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
  },
  row: {
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { color: colors.ink, fontSize: 15, flexShrink: 1 },
  value: { color: colors.muted, fontSize: 14 },
  input: { flex: 1, textAlign: "right", color: colors.ink, fontSize: 15 },
  note: { marginHorizontal: 18, marginTop: 8, color: colors.muted, fontSize: 12, lineHeight: 18 },
  signOut: { marginHorizontal: 18, marginTop: 18, paddingVertical: 14, alignItems: "center" },
  signOutText: { color: colors.red, fontWeight: "700", fontSize: 16 },
  saveBar: { alignItems: "center", paddingTop: 8, paddingBottom: 12 },
});
