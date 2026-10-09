import { type Href, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Icon } from "react-native-paper";
import { ErrorNote, Header, Screen } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { api, fileUrl } from "@/lib/api";
import { isPhotoHidden, removeShotByPhotoId, restoreShot, unhidePhoto } from "@/lib/burst";
import { formatArea, formatFeet } from "@/lib/format";
import { LOSS_ROLES, TRIGGERS, claimMeta } from "@/lib/matrix";
import { colors } from "@/theme";

const ROOM_TRIGGERS = TRIGGERS.slice(0, 6);
const CAT_HINT = ["Sanitary", "Sig. Cont.", "Grossly Cont."] as const;

const IICRC: Record<string, { title: string; subtitle: string; sections: { h: string; items: string[] }[] }> = {
  cat1: {
    title: "Water Category 1 — Sanitary",
    subtitle: "Originates from a sanitary source. No substantial risk if ingested or contacted.",
    sections: [
      { h: "Common Sources", items: ["Broken supply lines and faucets", "Toilet tank (no contaminants)", "Rainwater entry through roof or window", "Melted ice or snow"] },
      { h: "Watch For", items: ["Can deteriorate to Cat 2 or 3 over 24–48 hours", "Contact with building materials may add contaminants", "Long dwell time upgrades the category"] },
    ],
  },
  cat2: {
    title: "Water Category 2 — Significantly Contaminated",
    subtitle: "May cause discomfort or sickness if contacted or ingested.",
    sections: [
      { h: "Common Sources", items: ["Dishwasher or washing machine discharge", "Toilet overflow with urine only", "Hydrostatic seepage", "Punctured water beds, aquariums"] },
      { h: "Mitigation", items: ["Antimicrobial treatment is typically warranted", "Some porous materials may need removal", "PPE required for technicians"] },
    ],
  },
  cat3: {
    title: "Water Category 3 — Grossly Contaminated",
    subtitle: "Contains pathogenic, toxigenic, or other harmful agents.",
    sections: [
      { h: "Common Sources", items: ["Sewage backup", "Rising flood water", "Hurricane or wind-driven rain", "Toilet overflow with feces"] },
      { h: "Critical Requirements", items: ["Full PPE", "Porous materials typically removed", "HEPA vacuum and antimicrobial treatment"] },
    ],
  },
  class1: {
    title: "Water Class 1 — Least Amount",
    subtitle: "Smallest amount of water absorption and evaporation load.",
    sections: [{ h: "Indicators", items: ["Less than about 5% of the room is wet", "Low-permeance materials primarily affected", "Minimal wicking up walls"] }],
  },
  class2: {
    title: "Water Class 2 — Fast Evaporation Rate",
    subtitle: "Significant absorption. The whole room is affected.",
    sections: [{ h: "Indicators", items: ["Wetness wicked up walls 12–24 inches", "Carpet and pad saturated", "Cushion and structural materials affected"] }],
  },
  class3: {
    title: "Water Class 3 — Fastest Evaporation Rate",
    subtitle: "Largest amount of water absorbed, often from above.",
    sections: [{ h: "Indicators", items: ["Ceilings, walls, insulation, and flooring saturated", "Water source from overhead"] }],
  },
  class4: {
    title: "Water Class 4 — Specialty Drying",
    subtitle: "Materials with very low permeance.",
    sections: [{ h: "Indicators", items: ["Hardwood, brick, stone, or plaster saturated", "Standard drying methods are not enough"] }],
  },
};

export default function RoomScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload } = useBundle(id);
  const [readingOpen, setReadingOpen] = useState(false);
  const [reading, setReading] = useState({ location: "", value: "", unit: "WME" });
  const [note, setNote] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);

  const tile = (width - 36 - 18) / 4;

  if (error) {
    return (
      <Screen>
        <Header title="Room" back={`/claims/${id}` as Href} />
        <ErrorNote message={error} />
      </Screen>
    );
  }
  if (loading || !data) {
    return (
      <Screen>
        <Header title="Room" back={`/claims/${id}` as Href} />
        <Text style={styles.loading}>Loading room…</Text>
      </Screen>
    );
  }

  const room = data.rooms.find((item) => item.id === roomId);
  if (!room) {
    return (
      <Screen>
        <Header title="Room" back={`/claims/${id}` as Href} />
        <ErrorNote message="Room not found" />
      </Screen>
    );
  }

  const meta = claimMeta(data.claim.claimType);
  const photos = data.photos.filter(
    (photo) => photo.roomId === room.id && !photo.deletedAt && !removed.includes(photo.id) && !isPhotoHidden(photo.id),
  );
  const readings = data.readings.filter((item) => item.roomId === room.id);
  const scope = note ?? room.scopeNote ?? "";
  const showWater = meta.water;
  const sheet = sheetKey ? IICRC[sheetKey] : null;
  const scanHref = `/claims/${id}/rooms/${roomId}/scan` as Href;

  async function deletePhoto(photoId: string) {
    setRemoved((ids) => (ids.includes(photoId) ? ids : [...ids, photoId]));
    const shot = removeShotByPhotoId(photoId);
    try {
      await api(`/api/photos/${photoId}`, { method: "DELETE" });
      await reload();
    } catch {
      setRemoved((ids) => ids.filter((item) => item !== photoId));
      if (shot) restoreShot(shot);
      else unhidePhoto(photoId);
    }
  }

  async function patch(body: Record<string, unknown>) {
    await api(`/api/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify(body) });
    await reload();
  }

  async function addReading() {
    await api(`/api/rooms/${roomId}/readings`, {
      method: "POST",
      body: JSON.stringify({ ...reading, value: Number(reading.value) }),
    });
    setReadingOpen(false);
    setReading({ location: "", value: "", unit: reading.unit });
    await reload();
  }

  return (
    <Screen>
      <Header
        title={room.name}
        back={`/claims/${id}` as Href}
        right={
          <Pressable style={styles.headerIcon} onPress={() => router.push(scanHref)} hitSlop={6}>
            <Icon source="cube-scan" size={18} color={colors.navy} />
          </Pressable>
        }
      />
      <ScrollView key={room.id} contentContainerStyle={styles.page}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lossScroll} contentContainerStyle={styles.lossRow}>
          {LOSS_ROLES.map((role) => {
            const on = room.lossRole === role;
            return (
              <Pressable key={role} onPress={() => patch({ lossRole: role })} style={[styles.lossChip, on && styles.lossChipOn]}>
                <Text style={[styles.lossText, on && styles.lossTextOn]}>{role}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.triggerRow}>
          {ROOM_TRIGGERS.map((trigger) => {
            const on = room.triggers.includes(trigger);
            return (
              <Pressable
                key={trigger}
                onPress={() => {
                  const next = on ? room.triggers.filter((item) => item !== trigger) : [...room.triggers, trigger];
                  patch({ triggers: next });
                }}
                style={[styles.triggerChip, on && styles.triggerChipOn]}
              >
                <Text style={[styles.triggerText, on && styles.triggerTextOn]}>{trigger}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Photos ({photos.length})</Text>
        <View style={styles.photoGrid}>
          {photos.map((photo) => (
            <View key={photo.id} style={[styles.thumb, { width: tile, height: tile }]}>
              <Pressable style={styles.thumbHit} onPress={() => router.push(`/claims/${id}/photos/${photo.id}` as Href)}>
                {photo.hasImage ? <Image source={{ uri: fileUrl(photo.id) }} style={styles.thumbImage} /> : null}
                {photo.captionCode ? (
                  <View style={styles.thumbTag}>
                    <Text style={styles.thumbTagText}>{photo.captionCode}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable style={styles.thumbDelete} hitSlop={6} onPress={() => deletePhoto(photo.id)}>
                <Icon source="close" size={12} color={colors.white} />
              </Pressable>
            </View>
          ))}
          <Pressable
            style={[styles.addTile, { width: tile, height: tile }]}
            onPress={() => router.push(`/claims/${id}/camera?room=${room.id}` as Href)}
          >
            <Icon source="plus" size={22} color={colors.orange} />
          </Pressable>
        </View>

        {showWater ? (
          <View style={styles.water}>
            <View style={styles.waterHead}>
              <Icon source="water" size={16} color={colors.blue} />
              <Text style={styles.waterTitle}>Water Documentation · IICRC S500</Text>
            </View>

            <Pressable style={styles.refCard} onPress={() => setRefOpen((open) => !open)}>
              <View style={styles.refToggle}>
                <Icon source="information-outline" size={16} color={colors.blue} />
                <Text style={styles.refTitle}>Quick reference — Categories & Classes</Text>
                <Icon source={refOpen ? "chevron-up" : "chevron-right"} size={18} color={colors.blue} />
              </View>
              {refOpen ? (
                <Text style={styles.refBody}>
                  Categories describe water cleanliness at the source.{"\n"}
                  Cat 1 — Sanitary (supply lines, rain, melted ice).{"\n"}
                  Cat 2 — Significantly contaminated (dishwasher, washing machine, urine-only toilet overflow).{"\n"}
                  Cat 3 — Grossly contaminated (sewage, flood water).{"\n\n"}
                  Classes describe how much water the room has to dry.{"\n"}
                  Class 1 — Less than about 5% of the room is wet.{"\n"}
                  Class 2 — The room is wet, with wicking up the walls.{"\n"}
                  Class 3 — Ceilings, walls, insulation, and flooring are saturated.{"\n"}
                  Class 4 — Low-permeance materials such as hardwood, brick, or stone.
                </Text>
              ) : null}
            </Pressable>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.iicrcRow}>
              {([1, 2, 3] as const).map((value) => {
                const on = room.iicrcCategory === value;
                return (
                  <View key={value} style={styles.iicrcSlot}>
                    <Pressable style={[styles.iicrcChip, on && styles.iicrcChipOn]} onPress={() => patch({ iicrcCategory: value })}>
                      <Text style={[styles.iicrcLabel, on && styles.iicrcLabelOn]}>Cat {value}</Text>
                      <Text style={[styles.iicrcHint, on && styles.iicrcLabelOn]}>{CAT_HINT[value - 1]}</Text>
                    </Pressable>
                    <Pressable style={[styles.infoBtn, on && styles.infoBtnOn]} hitSlop={6} onPress={() => setSheetKey(`cat${value}`)}>
                      <Icon source="information-outline" size={11} color={on ? colors.white : colors.blue} />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Class</Text>
            <View style={styles.iicrcRow}>
              {([1, 2, 3, 4] as const).map((value) => {
                const on = room.iicrcClass === value;
                return (
                  <View key={value} style={styles.iicrcSlot}>
                    <Pressable style={[styles.iicrcChip, on && styles.iicrcChipOn]} onPress={() => patch({ iicrcClass: value })}>
                      <Text style={[styles.iicrcLabel, on && styles.iicrcLabelOn]}>{value}</Text>
                    </Pressable>
                    <Pressable style={[styles.infoBtn, on && styles.infoBtnOn]} hitSlop={6} onPress={() => setSheetKey(`class${value}`)}>
                      <Icon source="information-outline" size={11} color={on ? colors.white : colors.blue} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <Text style={[styles.section, styles.sectionFlush]}>Moisture</Text>
            <Pressable onPress={() => setReadingOpen(true)}>
              <Text style={styles.link}>Add</Text>
            </Pressable>
          </View>
          {readings.map((item) => (
            <Text key={item.id} style={styles.body}>
              {item.location} — {item.value} {item.unit}
            </Text>
          ))}
          {readingOpen ? (
            <View style={styles.card}>
              <TextInput style={styles.line} placeholder="Location" placeholderTextColor={colors.ink} value={reading.location} onChangeText={(location) => setReading((current) => ({ ...current, location }))} />
              <TextInput style={styles.line} placeholder="Value" placeholderTextColor={colors.ink} keyboardType="decimal-pad" value={reading.value} onChangeText={(value) => setReading((current) => ({ ...current, value }))} />
              <Pressable onPress={addReading}>
                <Text style={styles.link}>Save reading</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.section}>Measurements</Text>
        <View style={styles.measGrid}>
          <Meas label="Length" value={room.measurements ? formatFeet(room.measurements.lengthFt) : "—"} />
          <Meas label="Width" value={room.measurements ? formatFeet(room.measurements.widthFt) : "—"} />
          <Meas label="Height" value={room.measurements ? formatFeet(room.measurements.heightFt) : "—"} />
          <Meas label="Area" value={room.measurements ? formatArea(room.measurements.areaSqFt) : "—"} />
        </View>
        <Pressable style={styles.scanRow} onPress={() => router.push(scanHref)}>
          <Icon source="cube-scan" size={18} color={colors.orange} />
          <Text style={styles.scanText}>{room.measurements ? "Rescan with LiDAR" : "Scan this room with LiDAR"}</Text>
        </Pressable>

        <View style={styles.block}>
          <Text style={[styles.section, styles.sectionFlush]}>Scope note</Text>
          <TextInput
            style={styles.input}
            multiline
            value={scope}
            onChangeText={setNote}
            onEndEditing={() => patch({ scopeNote: scope })}
            placeholder="Notes for this room"
            placeholderTextColor={colors.ink}
          />
        </View>
      </ScrollView>

      {sheet ? (
        <View style={styles.sheetWrap}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheetKey(null)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{sheet.title}</Text>
            <Text style={styles.sheetSub}>{sheet.subtitle}</Text>
            <ScrollView style={styles.sheetBody}>
              {sheet.sections.map((section) => (
                <View key={section.h} style={styles.sheetSection}>
                  <Text style={styles.sheetHeading}>{section.h}</Text>
                  {section.items.map((item) => (
                    <Text key={item} style={styles.sheetItem}>
                      {item}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setSheetKey(null)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function Meas({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meas}>
      <Text style={styles.measLabel}>{label}</Text>
      <Text style={styles.measValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40 },
  loading: { color: colors.muted, fontSize: 13, padding: 18 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  lossScroll: {
    flexGrow: 0,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lossRow: {
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  lossChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  lossChipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  lossText: { fontSize: 12, fontWeight: "600", color: "#3a4456" },
  lossTextOn: { color: colors.white },
  triggerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  triggerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  triggerChipOn: { backgroundColor: "#e0eaf9", borderColor: colors.blue },
  triggerText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  triggerTextOn: { color: colors.blue },
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 18,
  },
  sectionFlush: { marginHorizontal: 0, marginTop: 0 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 18 },
  thumb: { borderRadius: 6, overflow: "hidden", backgroundColor: colors.navy },
  thumbHit: { flex: 1 },
  thumbImage: { width: "100%", height: "100%" },
  thumbDelete: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbTag: {
    position: "absolute",
    left: 2,
    bottom: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  thumbTagText: { color: colors.white, fontSize: 8, fontWeight: "700", letterSpacing: 0.4 },
  addTile: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.orange,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  water: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#e9f0fb",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#c2d4ef",
  },
  waterHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  waterTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.blue,
  },
  refCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#c2d4ef",
    marginBottom: 12,
  },
  refToggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  refTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.blue },
  refBody: { marginTop: 10, fontSize: 11, lineHeight: 18, color: "#3a4456" },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  iicrcRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  iicrcSlot: { flex: 1 },
  iicrcChip: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  iicrcChipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  iicrcLabel: { fontSize: 11, fontWeight: "700", color: colors.ink },
  iicrcLabelOn: { color: colors.white },
  iicrcHint: { fontSize: 8, fontWeight: "500", color: colors.muted, marginTop: 2 },
  infoBtn: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(45, 95, 181, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnOn: { backgroundColor: "rgba(255,255,255,0.25)" },
  block: { paddingHorizontal: 18, marginTop: 16, gap: 8 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  body: { color: colors.ink, fontSize: 15 },
  link: { color: colors.orange, fontWeight: "700" },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  line: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, color: colors.ink },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18 },
  meas: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  measLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: colors.muted },
  measValue: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginTop: 10,
  },
  scanText: { color: colors.orange, fontWeight: "700", fontSize: 13 },
  input: {
    minHeight: 90,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    textAlignVertical: "top",
  },
  sheetWrap: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(15, 42, 68, 0.35)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 12,
    maxHeight: "70%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d3d8e2", alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  sheetSub: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 14 },
  sheetBody: { maxHeight: 280 },
  sheetSection: { backgroundColor: colors.bg, borderRadius: 10, padding: 12, marginBottom: 12 },
  sheetHeading: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.blue, marginBottom: 6 },
  sheetItem: { fontSize: 12, lineHeight: 18, color: "#3a4456", paddingVertical: 2 },
  closeBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  closeText: { fontWeight: "700", color: colors.ink, fontSize: 14 },
});
