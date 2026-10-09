import { type Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { AddressField } from "@/components/address-field";
import { ErrorNote, Header, PrimaryButton, Screen, SyncPill } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { Icon } from "react-native-paper";
import { api } from "@/lib/api";
import { TRIGGERS, claimMeta } from "@/lib/matrix";
import type { Claim, Room } from "@/lib/types";
import { colors } from "@/theme";

type FileDraft = Pick<Claim, "insuredName" | "claimNumber" | "dateOfLoss" | "riskAddress" | "carrier" | "policeReport">;

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, reload } = useBundle(id);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [draft, setDraft] = useState<FileDraft | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [savingFile, setSavingFile] = useState(false);

  if (error) {
    return (
      <Screen>
        <Header title="Claim" back={"/(tabs)" as Href} />
        <ErrorNote message={error} />
      </Screen>
    );
  }
  if (loading || !data) {
    return (
      <Screen>
        <Header title="Claim" back={"/(tabs)" as Href} />
        <Text style={styles.empty}>Loading the risk…</Text>
      </Screen>
    );
  }

  const { claim, rooms, photos, deficiencies } = data;
  const meta = claimMeta(claim.claimType);
  const exterior = rooms.filter((room) => room.section === "exterior");
  const roof = rooms.filter((room) => room.section === "roof");
  const interior = rooms.filter((room) => room.section === "interior");
  const live = photos.filter((photo) => !photo.deletedAt);

  async function toggleTrigger(trigger: string) {
    const triggers = claim.triggers.includes(trigger)
      ? claim.triggers.filter((item) => item !== trigger)
      : [...claim.triggers, trigger];
    await api(`/api/claims/${claim.id}`, { method: "PATCH", body: JSON.stringify({ triggers }) });
    const origin = interior.find((room) => room.lossRole === "Origin") || interior[0];
    if (origin) {
      const roomTriggers = origin.triggers.includes(trigger)
        ? origin.triggers.filter((item) => item !== trigger)
        : [...origin.triggers, trigger];
      await api(`/api/rooms/${origin.id}`, { method: "PATCH", body: JSON.stringify({ triggers: roomTriggers }) });
    }
    setFlagsOpen(false);
    reload();
  }

  return (
    <Screen>
      <Header
        status={claim.syncStatus}
        title={claim.claimNumber}
        sub={`${claim.riskAddress || "Risk address"} — ${meta.label}`}
        back={"/(tabs)" as Href}
        right={
          <View style={styles.headerActions}>
            <Pressable onPress={() => {}}>
              <Icon source="export" size={20} color={colors.orange} />
            </Pressable>
          </View>
        }
      />
      <KeyboardAwareScrollView contentContainerStyle={styles.page} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View style={styles.flags}>
          {claim.triggers.map((trigger) => (
            <Text key={trigger} style={styles.flag}>
              {trigger}
            </Text>
          ))}
          <Pressable onPress={() => setFlagsOpen((open) => !open)}>
            <Text style={styles.addFlag}>+ Add flag</Text>
          </Pressable>
        </View>
        {flagsOpen ? (
          <View style={styles.sheet}>
            {TRIGGERS.map((trigger) => (
              <Pressable key={trigger} onPress={() => toggleTrigger(trigger)}>
                <Text style={[styles.chip, claim.triggers.includes(trigger) && styles.chipOn]}>{trigger}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Text style={styles.section}>File</Text>
        {fileError ? <ErrorNote message={fileError} /> : null}
        {draft ? (
          <View style={styles.fileEdit}>
            <FileField label="Insured" value={draft.insuredName} onChangeText={(insuredName) => setDraft({ ...draft, insuredName })} />
            <FileField label="Claim number" value={draft.claimNumber} onChangeText={(claimNumber) => setDraft({ ...draft, claimNumber })} />
            <FileField label="Date of loss" value={draft.dateOfLoss} onChangeText={(dateOfLoss) => setDraft({ ...draft, dateOfLoss })} />
            <AddressField value={draft.riskAddress} onPlaceSelected={(riskAddress) => setDraft({ ...draft, riskAddress })} />
            <FileField label="Carrier" value={draft.carrier} onChangeText={(carrier) => setDraft({ ...draft, carrier })} />
            {claim.claimType === "vandalism" ? (
              <FileField label="Police report" value={draft.policeReport || ""} onChangeText={(policeReport) => setDraft({ ...draft, policeReport })} />
            ) : null}
            <Pressable
              style={styles.fileSave}
              disabled={savingFile}
              onPress={async () => {
                setSavingFile(true);
                setFileError(null);
                try {
                  await api(`/api/claims/${claim.id}`, { method: "PATCH", body: JSON.stringify(draft) });
                  setDraft(null);
                  reload();
                } catch (err) {
                  setFileError(err instanceof Error ? err.message : "Could not save the file");
                } finally {
                  setSavingFile(false);
                }
              }}
            >
              <Text style={styles.fileSaveText}>{savingFile ? "Saving…" : "Save file"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.fileCard}>
            <FileLine label="Insured" value={claim.insuredName} />
            <FileLine label="Claim number" value={claim.claimNumber} />
            <FileLine label="Date of loss" value={claim.dateOfLoss} />
            <FileLine label="Risk address" value={claim.riskAddress} />
            <FileLine label="Carrier" value={claim.carrier} />
            {claim.claimType === "vandalism" ? <FileLine label="Police report" value={claim.policeReport || ""} /> : null}
            <Pressable
              onPress={() =>
                setDraft({
                  insuredName: claim.insuredName || "",
                  claimNumber: claim.claimNumber || "",
                  dateOfLoss: claim.dateOfLoss || "",
                  riskAddress: claim.riskAddress || "",
                  carrier: claim.carrier || "",
                  policeReport: claim.policeReport || "",
                })
              }
            >
              <Text style={styles.link}>Edit file</Text>
            </Pressable>
          </View>
        )}
        <PrimaryButton
          label={`Start capturing — ${exterior.find((room) => room.name === "Front Elevation")?.name || exterior[0]?.name || "Exterior"}`}
          onPress={() => {
            const front = exterior.find((room) => room.name === "Front Elevation") ?? exterior[0];
            router.push((front ? `/claims/${id}/camera?room=${front.id}` : `/claims/${id}/camera`) as Href);
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <Text style={{ fontStyle: "italic", color: colors.muted, fontSize: 11 }}>Or follow the capture workflow &rarr;</Text>
        <Pressable onPress={() => router.push(`/claims/${id}/workflow` as Href)}>
          <Text style={styles.link}>View workflow</Text>
        </Pressable>
        </View>
        <RoomSection title="Exterior" rooms={exterior} photos={live} claimId={id} />
        {roof.length ? <RoomSection title="Roof" rooms={roof} photos={live} claimId={id} /> : null}
        <RoomSection title="Interior" rooms={interior} photos={live} claimId={id} />
        <Text style={styles.note}>Rooms are added from capture as you find them. Extra structures use the room name, for example Garage — Front Elevation.</Text>
        <Pressable style={styles.deficiency} onPress={() => router.push(`/claims/${id}/deficiencies` as Href)}>
          <Text style={styles.deficiencyText}>Deficiency check</Text>
          <Text style={styles.badge}>{deficiencies.issues.length}</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function FileLine({ label, value }: { label: string; value: string }) {
  const missing = value.trim().length === 0;
  return (
    <View style={styles.fileLine}>
      <Text style={styles.fileLabel}>{label}</Text>
      <Text style={[styles.fileValue, missing && styles.fileMissing]}>{missing ? "Not set" : value}</Text>
    </View>
  );
}

function FileField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fileField}>
      <Text style={styles.fileLabel}>{label}</Text>
      <TextInput style={styles.fileInput} value={value} placeholderTextColor={colors.ink} onChangeText={onChangeText} />
    </View>
  );
}

function RoomSection({
  title,
  rooms,
  photos,
  claimId,
}: {
  title: string;
  rooms: Room[];
  photos: { roomId: string | null; kind: string }[];
  claimId: string;
}) {
  return (
    <View>
      <Text style={styles.section}>{title}</Text>
      {rooms.length === 0 ? <Text style={styles.note}>None yet.</Text> : null}
      {rooms.map((room) => {
        const count = photos.filter((photo) => photo.roomId === room.id && photo.kind !== "thermal").length;
        const thermal = photos.filter((photo) => photo.roomId === room.id && photo.kind === "thermal").length;
        return (
          <Pressable key={room.id} style={styles.room} onPress={() => router.push(`/claims/${claimId}/rooms/${room.id}` as Href)}>
            <View>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.note}>
                {count} photos{thermal ? ` · ${thermal} thermal` : ""}
                {room.lossRole ? ` · ${room.lossRole}` : ""}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 12, paddingBottom: 40 },
  empty: { padding: 18, color: colors.muted },
  headerActions: { flexDirection: "column", alignItems: "center", gap: 8 },
  icon: { color: colors.orange, fontWeight: "700" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flag: { backgroundColor: "#fff1e4", color: "#b45309", borderRadius: 99, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: "700" },
  addFlag: { color: colors.navy, backgroundColor: colors.line, borderRadius: 99, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, fontWeight: "700" },
  sheet: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 99, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, color: colors.ink },
  chipOn: { backgroundColor: colors.navy, color: colors.white, borderColor: colors.navy },
  link: { textAlign: "center", color: colors.orange, fontWeight: "700" },
  section: { marginTop: 8, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  room: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomName: { fontWeight: "700", color: colors.ink, fontSize: 16 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chevron: { color: colors.muted, fontSize: 22 },
  deficiency: {
    marginTop: 8,
    backgroundColor: colors.navy,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deficiencyText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  fileCard: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  fileEdit: { gap: 10 },
  fileLine: { gap: 2 },
  fileLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: colors.muted },
  fileValue: { color: colors.ink, fontSize: 15 },
  fileMissing: { color: colors.red },
  fileField: { gap: 6 },
  fileInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  fileSave: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  fileSaveText: { color: colors.white, fontWeight: "700" },
  badge: { color: colors.navy, backgroundColor: colors.orange, overflow: "hidden", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, fontWeight: "700" },
});
