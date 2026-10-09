import * as ImagePicker from "expo-image-picker";
import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ErrorNote, Header, PrimaryButton, Screen } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { api, apiUpload, fileUrl } from "@/lib/api";
import { formatArea, formatFeet } from "@/lib/format";
import { alertNoLidar, isRoomScanSupported } from "@/lib/lidar";
import { type Chip, chipsForRoom } from "@/lib/matrix";
import type { PhotoKind, Room, Section } from "@/lib/types";
import { colors } from "@/theme";

function param(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function CaptureScreen() {
  const { id, room, chip } = useLocalSearchParams<{ id: string; room?: string; chip?: string }>();
  const { data, error, loading, reload } = useBundle(id);

  if (error) {
    return (
      <Screen>
        <Header title="Capture" back={`/claims/${id}` as Href} />
        <ErrorNote message={error} />
      </Screen>
    );
  }
  if (loading || !data) {
    return (
      <Screen>
        <Header title="Capture" back={`/claims/${id}` as Href} />
        <Text style={styles.note}>Loading capture set…</Text>
      </Screen>
    );
  }

  return <CaptureForm id={id} data={data} initialRoomId={param(room)} initialChip={param(chip)} reload={reload} />;
}

function CaptureForm({
  id,
  data,
  initialRoomId,
  initialChip,
  reload,
}: {
  id: string;
  data: NonNullable<ReturnType<typeof useBundle>["data"]>;
  initialRoomId: string;
  initialChip: string;
  reload: () => Promise<unknown>;
}) {
  const { room: roomParam } = useLocalSearchParams<{ room?: string }>();
  const urlRoomId = param(roomParam);
  const [roomId, setRoomId] = useState(initialRoomId || urlRoomId);
  const [selectedChip, setSelectedChip] = useState(initialChip);
  useEffect(() => {
    if (urlRoomId) setRoomId(urlRoomId);
  }, [urlRoomId]);
  const [caption, setCaption] = useState("");
  const [kind, setKind] = useState<PhotoKind>("standard");
  const [newRoom, setNewRoom] = useState("");
  const [section, setSection] = useState<Section>("interior");
  const [saving, setSaving] = useState(false);
  const [checkingLidar, setCheckingLidar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeRoom = data.rooms.find((item) => item.id === roomId) ?? data.rooms[0];
  const chips = activeRoom ? chipsForRoom(data.claim.claimType, activeRoom) : [];
  const currentChip = chips.some((item) => item.label === selectedChip) ? selectedChip : chips[0]?.label || "Overview";

  function selectRoom(nextId: string) {
    setRoomId(nextId);
    setSelectedChip("");
    router.setParams({ room: nextId });
  }
  const chipGroups = groupChips(chips);
  const roomPhotos = activeRoom
    ? data.photos
        .filter((photo) => photo.roomId === activeRoom.id && !photo.deletedAt)
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    : [];

  async function addRoom() {
    const name = newRoom.trim();
    if (!name) return;
    const created = await api<{ id: string }>(`/api/claims/${id}/rooms`, {
      method: "POST",
      body: JSON.stringify({ name, section }),
    });
    setRoomId(created.id);
    setSelectedChip("");
    router.setParams({ room: created.id });
    setNewRoom("");
    await reload();
  }

  async function save(image?: { uri: string; mimeType?: string | null }) {
    if (!activeRoom) return;
    setSaving(true);
    setMessage(null);
    try {
      const fields: Record<string, string> = { roomId: activeRoom.id, chip: currentChip, kind };
      if (caption.trim()) fields.caption = caption.trim();
      if (image) {
        await apiUpload(`/api/claims/${id}/photos`, image.uri, image.mimeType || "image/jpeg", fields);
      } else {
        await api(`/api/claims/${id}/photos`, { method: "POST", body: JSON.stringify(fields) });
      }
      setCaption("");
      setMessage(`${currentChip} saved on ${activeRoom.name}.`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save the photo");
    } finally {
      setSaving(false);
    }
  }

  /** Opens the LiDAR room scan for the active room, or tells the adjuster their phone can't scan. */
  async function scanRoom() {
    if (!activeRoom || checkingLidar) return;
    setCheckingLidar(true);
    try {
      const supported = await isRoomScanSupported();
      if (!supported) {
        alertNoLidar();
        return;
      }
      router.push(`/claims/${id}/rooms/${activeRoom.id}/scan` as Href);
    } finally {
      setCheckingLidar(false);
    }
  }

  async function pick(camera: boolean) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Photo permission was not granted.");
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.4 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.4, mediaTypes: ["images"] });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await save({ uri: asset.uri, mimeType: asset.mimeType });
  }

  return (
    <Screen>
      <Header title="Capture" sub={data.claim.claimNumber} back={`/claims/${id}` as Href} />
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.section}>Room</Text>
        <View style={styles.wrap}>
          {data.rooms.map((item) => (
            <RoomChoice key={item.id} room={item} selected={item.id === activeRoom?.id} onSelect={selectRoom} />
          ))}
        </View>
        <View style={styles.addRow}>
          <TextInput style={styles.input} value={newRoom} placeholderTextColor={colors.ink} placeholder="New room name" onChangeText={setNewRoom} />
          <Pressable style={styles.small} onPress={addRoom}>
            <Text style={styles.smallText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.wrap}>
          {(["exterior", "roof", "interior"] as Section[]).map((item) => (
            <Pressable key={item} onPress={() => setSection(item)}>
              <Text style={[styles.chip, section === item && styles.chipOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {activeRoom ? (
          <View style={styles.scanCard}>
            <View style={styles.scanText}>
              <Text style={styles.scanTitle}>Room dimensions</Text>
              <Text style={styles.note}>
                {activeRoom.measurements
                  ? `${formatFeet(activeRoom.measurements.lengthFt)} × ${formatFeet(activeRoom.measurements.widthFt)} × ${formatFeet(activeRoom.measurements.heightFt)} · ${formatArea(activeRoom.measurements.areaSqFt)} · ${activeRoom.measurements.source}`
                  : `No measurements for ${activeRoom.name} yet.`}
              </Text>
            </View>
            <Pressable style={styles.small} onPress={scanRoom} disabled={checkingLidar}>
              <Text style={styles.smallText}>{activeRoom.measurements ? "Rescan" : "Scan room"}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.section}>Chips for {activeRoom?.name ?? "this room"}</Text>
        <View key={activeRoom?.id ?? "none"} style={styles.chipGroup}>
        {chipGroups.map((group) => (
          <View key={group.title} style={styles.chipGroup}>
            {chipGroups.length > 1 ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
            <View style={styles.wrap}>
              {group.chips.map((item) => (
                <Pressable key={item.id} onPress={() => setSelectedChip(item.label)}>
                  <Text style={[styles.chip, item.required && styles.chipRequired, currentChip === item.label && styles.chipOn]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        </View>
        <Text style={styles.note}>Outlined chips are required for this claim type; the rest are conditional.</Text>
        <View style={styles.wrap}>
          {(["standard", "thermal", "video"] as PhotoKind[]).map((item) => (
            <Pressable key={item} onPress={() => setKind(item)}>
              <Text style={[styles.chip, kind === item && styles.chipOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.caption} value={caption} placeholderTextColor={colors.ink} placeholder="Caption" onChangeText={setCaption} multiline />
        {message ? <Text style={styles.note}>{message}</Text> : null}
        <PrimaryButton label={saving ? "Saving…" : "Choose photo"} onPress={() => pick(false)} disabled={saving} />
        <Pressable style={styles.secondary} onPress={() => pick(true)} disabled={saving}>
          <Text style={styles.secondaryText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => save()} disabled={saving}>
          <Text style={styles.secondaryText}>Save without image</Text>
        </Pressable>
        {activeRoom ? (
          <>
            <Text style={styles.section}>
              Captured in {activeRoom.name} · {roomPhotos.length}
            </Text>
            {roomPhotos.length === 0 ? <Text style={styles.note}>Nothing captured here yet.</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {roomPhotos.map((photo) => (
                <Pressable key={photo.id} style={styles.thumbCard} onPress={() => router.push(`/claims/${id}/photos/${photo.id}` as Href)}>
                  {photo.hasImage ? <Image source={{ uri: fileUrl(photo.id) }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
                  <Text style={styles.thumbLabel} numberOfLines={1}>
                    {photo.chip}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const GROUP_TITLES: Record<Chip["group"], string> = {
  universal: "Claim",
  exterior: "Elevation",
  roof: "Roof",
  interior: "Room",
  ceilingWall: "Ceiling / wall water",
  cabinetry: "Cabinetry",
  flooring: "Flooring",
  equipment: "Equipment",
  otherStructures: "Other structure",
  contents: "Contents",
};

function RoomChoice({ room, selected, onSelect }: { room: Room; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <Pressable onPress={() => onSelect(room.id)}>
      <Text style={[styles.chip, selected && styles.chipOn]}>{room.name}</Text>
    </Pressable>
  );
}

function groupChips(chips: Chip[]): { title: string; chips: Chip[] }[] {
  const groups: { title: string; chips: Chip[] }[] = [];
  for (const chip of chips) {
    const title = GROUP_TITLES[chip.group];
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.chips.push(chip);
    else groups.push({ title, chips: [chip] });
  }
  return groups;
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 12, paddingBottom: 48 },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 99, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, color: colors.ink, fontSize: 13 },
  chipRequired: { borderColor: colors.navy },
  chipOn: { backgroundColor: colors.navy, color: colors.white, borderColor: colors.navy },
  chipGroup: { gap: 6 },
  groupTitle: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink },
  small: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, justifyContent: "center" },
  smallText: { color: colors.white, fontWeight: "700" },
  scanCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 },
  scanText: { flex: 1, gap: 2 },
  scanTitle: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  caption: { minHeight: 72, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, textAlignVertical: "top" },
  note: { color: colors.muted, fontSize: 13 },
  secondary: { borderRadius: 12, paddingVertical: 14, alignItems: "center", backgroundColor: colors.line },
  secondaryText: { color: colors.navy, fontWeight: "700" },
  strip: { gap: 10 },
  thumbCard: { width: 96, gap: 4 },
  thumb: { width: 96, height: 72, borderRadius: 10, backgroundColor: colors.navy },
  thumbEmpty: { backgroundColor: colors.line },
  thumbLabel: { color: colors.muted, fontSize: 11 },
});
