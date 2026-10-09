import { CameraView, useCameraPermissions } from "expo-camera";
import { type Href, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBundle } from "@/hooks/use-bundle";
import { api, apiUpload } from "@/lib/api";
import { addShot, claimDiscarded, ensureBurst, hidePhoto, updateShot, useBurst } from "@/lib/burst";
import { roomCoverage } from "@/lib/coverage";
import { CAPTIONS, claimMeta, chipsForRoom } from "@/lib/matrix";
import type { CaptionCode } from "@/lib/types";
import { GlassIcon, GlassText } from "@/components/Glass";
import { colors } from "@/theme";
import { GlassView } from "expo-glass-effect";

function param(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default function CameraScreen() {
  const { id, room } = useLocalSearchParams<{ id: string; room?: string }>();
  const { data, error, loading, reload } = useBundle(id);
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const selection = useRef({ roomId: "", chip: "", captionCode: "" as CaptionCode | "" });
  const [roomId, setRoomId] = useState(param(room));
  const [chip, setChip] = useState("");
  const [captionCode, setCaptionCode] = useState<CaptionCode | "">("");
  const [taking, setTaking] = useState(false);
  const [namingRoom, setNamingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const shots = useBurst(id);
  const knownComplete = useRef<Set<string> | null>(null);
  const prompting = useRef<string | null>(null);

  useEffect(() => {
    ensureBurst(id);
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const complete = data.rooms.filter((room) => {
      const coverage = roomCoverage(data.claim.claimType, room, data.photos, shots);
      return coverage.total > 0 && coverage.taken >= coverage.total;
    });
    if (knownComplete.current === null) {
      knownComplete.current = new Set(complete.map((room) => room.id));
      return;
    }
    for (const roomId of knownComplete.current) {
      if (prompting.current === roomId) continue;
      if (!complete.some((room) => room.id === roomId)) knownComplete.current.delete(roomId);
    }
    const next = complete.find(
      (room) => !knownComplete.current?.has(room.id) && typeof room.damageObserved !== "boolean",
    );
    if (!next || prompting.current) return;
    knownComplete.current.add(next.id);
    prompting.current = next.id;
    Alert.alert(
      "Room completed",
      `${next.name} — is there any damage?`,
      [
        {
          text: "No",
          onPress: () => {
            void answerDamage(next.id, false);
          },
        },
        {
          text: "Yes",
          onPress: () => {
            void answerDamage(next.id, true);
          },
        },
      ],
      { cancelable: false },
    );

    async function answerDamage(targetId: string, damageObserved: boolean) {
      try {
        await api(`/api/rooms/${targetId}`, { method: "PATCH", body: JSON.stringify({ damageObserved }) });
        await reload();
      } catch {
        knownComplete.current?.delete(targetId);
      } finally {
        prompting.current = null;
      }
    }
  }, [data, shots, reload]);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync().catch(() => undefined);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
      };
    }, []),
  );

  if (error || (!loading && !data)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{error || "Claim not found"}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </View>
    );
  }
  if (loading || !data || !permission) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Opening camera…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Camera access is needed to capture this claim.</Text>
        <Pressable style={styles.permit} onPress={requestPermission}>
          <Text style={styles.permitText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  const activeRoom =
    data.rooms.find((item) => item.id === roomId) ??
    data.rooms.find((item) => item.name === "Front Elevation") ??
    data.rooms.find((item) => item.section === "exterior") ??
    data.rooms[0];
  const coverage = activeRoom ? roomCoverage(data.claim.claimType, activeRoom, data.photos, shots) : null;
  const chips = coverage?.chips ?? [];
  const meta = claimMeta(data.claim.claimType);
  const progress = coverage && coverage.total > 0 ? `${coverage.taken}/${coverage.total}` : "";
  const latest = shots[shots.length - 1];
  selection.current = { roomId: activeRoom?.id ?? "", chip, captionCode };

  async function shoot() {
    const picked = selection.current;
    if (!picked.roomId || taking) return;
    setTaking(true);
    try {
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.4 });
      if (!picture?.uri) return;
      const key = `${Date.now()}-${shots.length}`;
      const shot = {
        key,
        uri: picture.uri,
        claimId: id,
        roomId: picked.roomId,
        chip: picked.chip,
        captionCode: picked.captionCode,
        placed: false,
        status: "saving" as const,
      };
      addShot(shot);
      const fields: Record<string, string> = { roomId: picked.roomId, chip: picked.chip || "Untagged", kind: "standard" };
      if (picked.captionCode) fields.captionCode = picked.captionCode;
      try {
        const saved = await apiUpload<{ id: string }>(`/api/claims/${id}/photos`, picture.uri, "image/jpeg", fields);
        if (claimDiscarded(key)) {
          hidePhoto(saved.id);
          await api(`/api/photos/${saved.id}`, { method: "DELETE" }).catch(() => undefined);
          await reload();
          return;
        }
        const latestShot = updateShot(key, { photoId: saved.id, status: "saved" });
        void reload();
        if (
          latestShot &&
          (latestShot.chip !== shot.chip || latestShot.roomId !== shot.roomId || latestShot.captionCode !== shot.captionCode)
        ) {
          await api(`/api/photos/${saved.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              roomId: latestShot.roomId,
              chip: latestShot.chip || "Untagged",
              captionCode: latestShot.captionCode || undefined,
            }),
          });
        }
      } catch {
        updateShot(key, { status: "failed" });
      }
    } finally {
      setTaking(false);
    }
  }

  async function addRoom() {
    const name = newRoom.trim();
    if (!name || savingRoom) return;
    setSavingRoom(true);
    try {
      const created = await api<{ id: string }>(`/api/claims/${id}/rooms`, {
        method: "POST",
        body: JSON.stringify({ name, section: "interior" }),
      });
      await reload();
      setRoomId(created.id);
      setChip("");
      setNewRoom("");
      setNamingRoom(false);
    } catch {
      return;
    } finally {
      setSavingRoom(false);
    }
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" mode="picture" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <GlassIcon name="chevron.left" onPress={() => router.back()} />

        <View style={styles.roomButton}>
          <GlassText padding={{ horizontal: 12, vertical: 10 }} weight="bold" size={12}>
            {activeRoom?.name ?? "Room"}
            {progress ? `  ${progress}` : ""}
          </GlassText>
          <Text style={styles.sectionName}>
            {activeRoom?.section ?? "claim"} · {meta.label}
          </Text>
        </View>
        <Pressable style={styles.done} onPress={() => router.push(`/claims/${id}/tray` as Href)}>
          <Text style={styles.doneText}>Done</Text>
          <Text style={styles.badge}>{shots.length}</Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        <Text style={styles.tiny}>Caption</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {CAPTIONS.map((item) => {
            const armed = captionCode === item.id;
            return (
              <GlassText
                key={item.id}
                weight="bold"
                selected={armed}
                color="#ffaa66"
                selectedColor="#fff"
                tint="rgba(232,119,34,0.25)"
                selectedTint={colors.orange}
                border="rgba(232,119,34,0.7)"
                selectedBorder="#fff"
                shape="roundedRectangle"
                cornerRadius={12}
                padding={{ horizontal: 10, vertical: 5 }}
                onPress={() => setCaptionCode(armed ? "" : item.id)}
              >
                {item.label}
              </GlassText>
            );
          })}
        </ScrollView>
        <Text style={styles.tiny}>Chips · {activeRoom?.name ?? "room"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {chips.map((item) => {
            const armed = chip === item.label;
            const done = coverage?.covered.has(item.label) ?? false;
            return (
              <GlassText
                key={item.id}
                selected={armed}
                selectedTint={colors.orange}
                onPress={() => setChip(armed ? "" : item.label)}
              >
                {done ? "✓ " : ""}
                {item.label}
                
              </GlassText>
            );
          })}
        </ScrollView>
        <View style={styles.controls}>
          <Pressable style={styles.thumb} onPress={() => router.push(`/claims/${id}/tray` as Href)}>
            {latest ? <Image source={{ uri: latest.uri }} style={styles.thumbImage} /> : null}
            {shots.length ? (
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>{shots.length}</Text>
              </View>
            ) : null}
          </Pressable>
          <GlassView style={{ padding: 6, borderRadius: 50, alignItems: "center", justifyContent: "center" }}>
          <Pressable style={[styles.shutter, taking && styles.shutterBusy]} onPress={shoot} disabled={taking} />
          </GlassView>
          <GlassIcon name="mic" onPress={() => console.log("mic")} />
         
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.roomRail, { top: insets.top + 72, bottom: insets.bottom + 230 }]}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.roomScroll} contentContainerStyle={styles.roomRailContent}>
          {data.rooms.map((item) => {
            const selected = item.id === activeRoom?.id;
            const roomProgress = roomCoverage(data.claim.claimType, item, data.photos, shots);
            const fraction = roomProgress.total > 0 ? `${roomProgress.taken}/${roomProgress.total}` : "";
            return (
              <GlassText
                key={item.id}
                alignSelf="flex-end"
                selected={selected}
                selectedTint={colors.orange}
                onPress={() => {
                  if (selected) return;
                  setRoomId(item.id);
                  const next = chipsForRoom(data.claim.claimType, item);
                  setChip((current) => (next.some((entry) => entry.label === current) ? current : ""));
                }}
              >
                {roomProgress.taken > 0 && roomProgress.taken === roomProgress.total ? "✓ " : ""}
                {item.name}
                
              </GlassText>
            );
          })}
          {namingRoom ? (
            <TextInput
              style={styles.addInput}
              value={newRoom}
              placeholder="New room"
              placeholderTextColor={colors.ink}
              onChangeText={setNewRoom}
              onSubmitEditing={addRoom}
              returnKeyType="done"
              autoFocus
            />
          ) : null}
          <GlassIcon alignSelf="flex-end" name={namingRoom ? "checkmark" : "plus"} onPress={namingRoom ? addRoom : () => setNamingRoom(true)} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  empty: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  emptyText: { color: "#fff", fontSize: 16, textAlign: "center" },
  link: { color: colors.orange, fontWeight: "700" },
  permit: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  permitText: { color: "#fff", fontWeight: "700" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  roundText: { color: "#fff", fontSize: 24, lineHeight: 28 },
  roomButton: { flex: 1, alignItems: "center" },
  roomName: { color: "#fff", fontWeight: "700", backgroundColor: "rgba(0,0,0,0.5)", overflow: "hidden", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6 },
  sectionName: { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  done: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(232,119,34,0.95)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  doneText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  badge: { backgroundColor: "#fff", color: colors.orange, overflow: "hidden", borderRadius: 10, paddingHorizontal: 6, fontSize: 11, fontWeight: "700" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, gap: 4 },
  tiny: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 16 },
  strip: { gap: 6, paddingHorizontal: 14, paddingBottom: 6 },
  caption: { color: "#ffaa66", backgroundColor: "rgba(232,119,34,0.25)", borderWidth: 1, borderColor: "rgba(232,119,34,0.7)", borderRadius: 12, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "700" },
  captionOn: { backgroundColor: colors.orange, color: "#fff", borderColor: "#fff" },
  camChip: { color: "#fff", backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 16, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 7, fontSize: 12, fontWeight: "600" },
  camChipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 22, paddingTop: 6 },
  thumb: { width: 52, height: 52, borderRadius: 8, borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "rgba(255,255,255,0.1)", overflow: "visible" },
  thumbImage: { width: "100%", height: "100%", borderRadius: 6 },
  thumbBadge: { position: "absolute", top: -6, right: -6, backgroundColor: colors.orange, borderRadius: 9, minWidth: 18, paddingHorizontal: 5, alignItems: "center" },
  thumbBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  shutter: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", borderWidth: 4, borderColor: "rgba(255,255,255,0.45)" },
  shutterBusy: { opacity: 0.5 },
  roomRail: { position: "absolute", right: 8, justifyContent: "center", alignItems: "flex-end", width: 160 },
  roomScroll: { flexGrow: 0, maxHeight: "100%" },
  roomRailContent: { alignItems: "flex-end", gap: 8 },
  addInput: {
    width: 140,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
  },
});
