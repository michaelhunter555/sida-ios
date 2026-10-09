import { type Href, router } from "expo-router";
import { useAuth } from "@/context/user-context";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AddressField } from "@/components/address-field";
import { ErrorNote, Header, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { CLAIM_TYPE_META, PHASE_2_TYPES } from "@/lib/matrix";
import type { ClaimType, Settings } from "@/lib/types";
import { colors } from "@/theme";
import { Icon } from "react-native-paper";
import DateTimePicker from '@expo/ui/community/datetime-picker';

const EMPTY = {
  insuredName: "",
  claimNumber: "",
  dateOfLoss: "",
  riskAddress: "",
  carrier: "",
  claimType: "water_plumbing" as ClaimType,
  policeReport: "",
};

export default function NewClaimScreen() {
  const auth = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const meta = CLAIM_TYPE_META.find((item) => item.id === form.claimType) ?? CLAIM_TYPE_META[0];

  useEffect(() => {
    api<Settings>("/api/settings")
      .then((settings) => {
        if (!settings.defaultCarrier) return;
        setForm((current) => (current.carrier ? current : { ...current, carrier: settings.defaultCarrier }));
      })
      .catch(() => undefined);
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function start() {
    setSaving(true);
    setError(null);
    try {
      const body = await api<{ id: string }>("/api/claims", { method: "POST", body: JSON.stringify(form) });
      router.replace(`/claims/${body.id}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the claim");
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="New claim" back={"/(tabs)" as Href} />
      {error ? <ErrorNote message={error} /> : null}
      <KeyboardAwareScrollView contentContainerStyle={styles.page} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View style={styles.paste}>
          <PrimaryButton icon={<Icon source="clipboard" size={24} color="white" />} label="Paste assignment from clipboard" onPress={() => undefined} />
        </View>
        <Field label="Insured" value={form.insuredName} onChangeText={(value) => set("insuredName", value)} />
        <Field label="Claim number" value={form.claimNumber} onChangeText={(value) => set("claimNumber", value)} />
        <DateField
          label="Date of loss"
          value={form.dateOfLoss}
          timeZone={auth.user?.timeZone}
          onChange={(value) => set("dateOfLoss", value)}
        />
        <AddressField value={form.riskAddress} onPlaceSelected={(address) => set("riskAddress", address)} />
        <Field label="Carrier" value={form.carrier} onChangeText={(value) => set("carrier", value)} />
        {form.claimType === "vandalism" ? (
          <Field label="Police report" value={form.policeReport} onChangeText={(value) => set("policeReport", value)} />
        ) : null}
        <Text style={styles.section}>Claim type</Text>
        <View style={styles.chips}>
          {CLAIM_TYPE_META.map((item) => (
            <Pressable key={item.id} style={[styles.chip, form.claimType === item.id && styles.chipOn]} onPress={() => set("claimType", item.id)}>
              <Text style={[styles.chipText, form.claimType === item.id && styles.chipTextOn]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helper}>{meta.helper}</Text>
        <Text style={styles.phase}>Later: {PHASE_2_TYPES.join(", ")}</Text>
        <PrimaryButton label={saving ? "Starting…" : "Start inspection"} onPress={start} disabled={saving} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function DateField({
  label,
  value,
  timeZone,
  onChange,
}: {
  label: string;
  value: string;
  timeZone?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.dateInput} onPress={() => setOpen((current) => !current)}>
        <Text style={[styles.dateText, !value && styles.placeholder]}>{value || "YYYY-MM-DD"}</Text>
        <Icon source="calendar" size={22} color={colors.orange} />
      </Pressable>
      {open ? (
        <DateTimePicker
          display="inline"
          mode="date"
          themeVariant="light"
          timeZoneName={timeZone || "America/New_York"}
          value={parseDate(value)}
          maximumDate={endOfToday()}
          accentColor={colors.orange}
          onDismiss={() => setOpen(false)}
          onValueChange={(_event, selectedDate) => {
            onChange(formatDate(selectedDate));
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} placeholder={placeholder} placeholderTextColor={colors.ink} onChangeText={onChangeText} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 12, paddingBottom: 40 },
  paste: { marginBottom: 12 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  dateInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: { fontSize: 16, color: colors.ink },
  placeholder: { color: colors.muted },
  section: { marginTop: 8, fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: colors.white },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  phase: { color: colors.muted, fontSize: 12 },
});
