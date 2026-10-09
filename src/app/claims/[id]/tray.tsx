import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { Header, Screen } from "@/components/ui";
import { useBundle } from "@/hooks/use-bundle";
import { api } from "@/lib/api";
import { removeShot, restoreShot, updateShot, useBurst, type BurstShot } from "@/lib/burst";
import { LOSS_ROLES } from "@/lib/matrix";
import type { LossRole, Room, Section } from "@/lib/types";
import { colors } from "@/theme";
import { Icon } from "react-native-paper";

type Frame = { x: number; y: number; width: number; height: number };
type Drag = { key: string; uri: string; x: number; y: number; originX: number; originY: number };

const GROUPS: { section: Section; title: string }[] = [
  { section: "exterior", title: "Exterior · Drop here" },
  { section: "roof", title: "Roof · Drop here" },
  { section: "interior", title: "Interior · Drop here" },
];

const DEFAULT_INTERIOR = ["Kitchen", "Dining Room", "Basement"];

export default function BurstTrayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, reload } = useBundle(id);
  const [newRoom, setNewRoom] = useState("");
  const [lossRole, setLossRole] = useState<LossRole>("Unknown");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const sheetY = useRef(new Animated.Value(1)).current;
  const seeding = useRef(false);
  const shots = useBurst(id);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const roomRefs = useRef<Record<string, View | null>>({});
  const frames = useRef<Record<string, Frame>>({});
  const boardRef = useRef<View>(null);

  const rooms = data?.rooms ?? [];
  const openShots = shots.filter((shot) => !shot.placed);
  const loose = shots.filter((shot) => !shot.chip || !shot.roomId);

  useEffect(() => {
    if (!data || seeding.current) return;
    const names = new Set(data.rooms.filter((room) => room.section === "interior").map((room) => room.name));
    const missing = DEFAULT_INTERIOR.filter((name) => !names.has(name));
    if (!missing.length) return;
    seeding.current = true;
    Promise.all(
      missing.map((name) =>
        api(`/api/claims/${id}/rooms`, { method: "POST", body: JSON.stringify({ name, section: "interior" }) }),
      ),
    )
      .then(() => reload())
      .finally(() => {
        seeding.current = false;
      });
  }, [data, id, reload]);

  function openSheet() {
    setSheetOpen(true);
    sheetY.setValue(1);
    Animated.timing(sheetY, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }

  function closeSheet() {
    Animated.timing(sheetY, { toValue: 1, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  }

  async function addInteriorRoom() {
    const name = newRoom.trim();
    if (!name || savingRoom) return;
    setSavingRoom(true);
    try {
      await api(`/api/claims/${id}/rooms`, { method: "POST", body: JSON.stringify({ name, section: "interior", lossRole }) });
      setNewRoom("");
      setLossRole("Unknown");
      closeSheet();
      await reload();
    } finally {
      setSavingRoom(false);
    }
  }

  function roomAt(x: number, y: number) {
    for (const [roomId, frame] of Object.entries(frames.current)) {
      const inside = x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
      if (inside) return roomId;
    }
    return null;
  }

  function captureFrames() {
    for (const [roomId, view] of Object.entries(roomRefs.current)) {
      view?.measureInWindow((x, y, width, height) => {
        frames.current[roomId] = { x, y, width, height };
      });
    }
  }

  function beginDrag(shot: BurstShot, x: number, y: number) {
    captureFrames();
    boardRef.current?.measureInWindow((originX, originY) => {
      setDrag({ key: shot.key, uri: shot.uri, x, y, originX, originY });
    });
    setHoverId(roomAt(x, y));
  }

  function moveDrag(x: number, y: number) {
    setDrag((current) => (current ? { ...current, x, y } : current));
    setHoverId(roomAt(x, y));
  }

  async function deleteShot(shot: BurstShot) {
    const removed = removeShot(shot.key);
    if (!removed?.photoId) return;
    try {
      await api(`/api/photos/${removed.photoId}`, { method: "DELETE" });
      await reload();
    } catch {
      restoreShot(removed);
    }
  }

  async function endDrag(shot: BurstShot, x: number, y: number) {
    const roomId = roomAt(x, y);
    setDrag(null);
    setHoverId(null);
    if (!roomId) return;
    const next = updateShot(shot.key, { roomId, placed: true });
    if (!next?.photoId) return;
    await api(`/api/photos/${next.photoId}`, {
      method: "PATCH",
      body: JSON.stringify({
        roomId: next.roomId,
        chip: next.chip || "Untagged",
        captionCode: next.captionCode || undefined,
      }),
    }).catch(() => undefined);
  }

  return (
    <GestureHandlerRootView style={styles.fill}>
      <Screen>
        <Header
          title="Tag photos"
          sub={
            loose.length
              ? `${loose.length} left to place · hold a photo, then drop it on a room`
              : "Tagged to the room and chip selected in the camera"
          }
          back={`/claims/${id}` as Href}
          right={
            <Pressable onPress={() => router.back()}>
              <Icon source="camera" size={24} color={colors.orange} />
            </Pressable>
          }
        />
        <View ref={boardRef} style={styles.fill} onLayout={captureFrames}>
          <ScrollView style={styles.photos} contentContainerStyle={styles.photoContent} scrollEnabled={!drag}>
            {shots.length === 0 ? <Text style={styles.note}>No photos in this burst yet.</Text> : null}
            {shots.length > 0 && openShots.length === 0 ? <Text style={styles.note}>Every photo in this burst is on a room.</Text> : null}
            <View style={styles.grid}>
              {openShots.map((shot) => (
                <DraggableThumb
                  key={shot.key}
                  shot={shot}
                  dragging={drag?.key === shot.key}
                  onStart={beginDrag}
                  onMove={moveDrag}
                  onEnd={endDrag}
                  onDelete={deleteShot}
                />
              ))}
            </View>
          </ScrollView>
          <ScrollView style={styles.targets} contentContainerStyle={styles.targetContent} scrollEnabled={!drag} onMomentumScrollEnd={captureFrames} onScrollEndDrag={captureFrames}>
            {GROUPS.map((group) => {
              const groupRooms = rooms.filter((room) => room.section === group.section);
              if (!groupRooms.length && group.section !== "interior") return null;
              return (
                <View key={group.section}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {groupRooms.length === 0 ? <Text style={styles.note}>No rooms in this section yet.</Text> : null}
                  {groupRooms.map((room) => (
                    <DropTarget
                      key={room.id}
                      room={room}
                      shots={shots.filter((shot) => shot.roomId === room.id)}
                      hover={hoverId === room.id}
                      bind={(node) => {
                        roomRefs.current[room.id] = node;
                      }}
                    />
                  ))}
                </View>
              );
            })}
          </ScrollView>
          {drag ? (
            <View pointerEvents="none" style={[styles.ghost, { left: drag.x - drag.originX - 36, top: drag.y - drag.originY - 48 }]}>
              <Image source={{ uri: drag.uri }} style={styles.ghostImage} />
            </View>
          ) : null}
        </View>
        <Pressable style={styles.fab} onPress={openSheet}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
        {sheetOpen ? (
          <Animated.View style={[styles.sheetBackdrop, { opacity: sheetY.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Pressable style={styles.fill} onPress={closeSheet} />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }] }]}>
                <Text style={styles.sheetTitle}>Create New Room</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={newRoom}
                  placeholder="Room name (e.g., Living Room, Master Bath)"
                  placeholderTextColor={colors.ink}
                  onChangeText={setNewRoom}
                />
                <Text style={styles.sheetLabel}>Loss Role</Text>
                <View style={styles.roleRow}>
                  {LOSS_ROLES.map((role) => (
                    <Pressable key={role} onPress={() => setLossRole(role)}>
                      <Text style={[styles.roleChip, lossRole === role && styles.roleChipOn]}>{role}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.sheetActions}>
                  <Pressable style={styles.cancelButton} onPress={closeSheet}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.confirmButton} onPress={addInteriorRoom} disabled={savingRoom}>
                    <Text style={styles.confirmText}>{savingRoom ? "Adding…" : "Add Room"}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </Animated.View>
        ) : null}
      </Screen>
    </GestureHandlerRootView>
  );
}

function DraggableThumb({
  shot,
  dragging,
  onStart,
  onMove,
  onEnd,
  onDelete,
}: {
  shot: BurstShot;
  dragging: boolean;
  onStart: (shot: BurstShot, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onEnd: (shot: BurstShot, x: number, y: number) => void;
  onDelete: (shot: BurstShot) => void;
}) {
  const handlers = useRef({ onStart, onMove, onEnd, shot });
  handlers.current = { onStart, onMove, onEnd, shot };
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activateAfterLongPress(220)
        .onStart((event) => handlers.current.onStart(handlers.current.shot, event.absoluteX, event.absoluteY))
        .onUpdate((event) => handlers.current.onMove(event.absoluteX, event.absoluteY))
        .onFinalize((event) => handlers.current.onEnd(handlers.current.shot, event.absoluteX, event.absoluteY)),
    [],
  );

  return (
    <View style={[styles.tile, !shot.chip && styles.untagged, dragging && styles.dragging]}>
      <GestureDetector gesture={pan}>
        <View>
          <Image source={{ uri: shot.uri }} style={styles.image} />
          <Text style={styles.tileLabel} numberOfLines={1}>
            {shot.chip || "Untagged"}
          </Text>
        </View>
      </GestureDetector>
      <Pressable style={styles.delete} hitSlop={8} onPress={() => onDelete(shot)}>
        <Icon source="close" size={14} color={colors.white} />
      </Pressable>
    </View>
  );
}

function DropTarget({
  room,
  shots,
  hover,
  bind,
}: {
  room: Room;
  shots: BurstShot[];
  hover: boolean;
  bind: (node: View | null) => void;
}) {
  const chips = [...new Set(shots.map((shot) => shot.chip).filter(Boolean))];
  const meta = shots.length === 0 ? "Drop here" : `${shots.length} assigned${chips.length ? ` · ${chips.slice(0, 2).join(" · ")}` : ""}`;
  return (
    <View ref={bind} style={[styles.target, hover && styles.targetHover]}>
      <Text style={styles.targetName}>{room.name}</Text>
      <Text style={styles.targetMeta} numberOfLines={1}>
        {meta}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  photos: { flex: 0.44, backgroundColor: colors.white, borderBottomWidth: 4, borderBottomColor: colors.line },
  photoContent: { padding: 14 },
  targets: { flex: 0.56, backgroundColor: colors.bg },
  targetContent: { padding: 14, paddingBottom: 28 },
  note: { color: colors.muted, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "31%", borderRadius: 8, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: colors.white },
  untagged: { borderColor: colors.orange },
  dragging: { opacity: 0.45 },
  image: { width: "100%", aspectRatio: 1, backgroundColor: colors.navy },
  tileLabel: { fontSize: 10, color: colors.ink, padding: 4 },
  delete: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  groupTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginTop: 8, marginBottom: 6 },
  target: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  targetHover: { borderColor: colors.orange, backgroundColor: "#fdf0e2" },
  targetName: { color: colors.ink, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  targetMeta: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: "right" },
  ghost: { position: "absolute", width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderColor: colors.orange, overflow: "hidden" },
  ghostImage: { width: "100%", height: "100%" },
  cameraLink: { color: colors.orange, fontWeight: "700", fontSize: 13 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: colors.orange,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  fabText: { color: "#fff", fontSize: 32, lineHeight: 34, fontWeight: "500" },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  sheetInput: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
  sheetLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8, color: colors.ink, fontWeight: "600", fontSize: 13 },
  roleChipOn: { backgroundColor: colors.orange, borderColor: colors.orange, color: "#fff" },
  sheetActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  cancelButton: { flex: 1, backgroundColor: colors.line, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.navy, fontWeight: "700" },
  confirmButton: { flex: 1, backgroundColor: colors.orange, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "700" },
});
