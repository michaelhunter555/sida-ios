import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ErrorNote, Header, PrimaryButton, Screen } from "@/components/ui";
import { api } from "@/lib/api";
import { formatArea, formatFeet } from "@/lib/format";
import {
  NO_LIDAR_MESSAGE,
  type RegionMeasurement,
  type RegionSelectedEvent,
  alertNoLidar,
  getLiDARCameraView,
  isRoomScanSupported,
  measureRegion,
  mm2ToSqFt,
  mmToFt,
  onDepthFrame,
  startSession,
  stopSession,
} from "@/lib/lidar";
import type { ScanRegion } from "@/lib/types";
import { colors } from "@/theme";

interface ScanResult {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  areaSqFt: number;
  pointCount: number;
  regions?: ScanRegion[];
}

type Support = "checking" | "ready" | "unsupported";
type Step = "wallA" | "wallB" | "damage" | "review";

/** One measured wall, in feet. */
interface Wall {
  lengthFt: number;
  heightFt: number;
  depthFt: number;
}

const STEP_COPY: Record<Exclude<Step, "review">, { title: string; hint: string }> = {
  wallA: {
    title: "Step 1 of 2 · Longest wall",
    hint: "Stand across the room so the whole wall fits on screen. Drag a box from one floor corner to the opposite ceiling corner.",
  },
  wallB: {
    title: "Step 2 of 2 · Adjacent wall",
    hint: "Turn to a wall that meets the first one and draw the same corner-to-corner box.",
  },
  damage: {
    title: "Damage area",
    hint: "Draw a box tightly around the damaged surface — stain, hole, buckled flooring. Each box is saved as its own area.",
  },
};

const TRACKING_HINT: Record<string, string> = {
  initializing: "Starting the sensor — hold still for a second.",
  excessiveMotion: "Moving too fast. Slow down so the sensor can lock on.",
  insufficientFeatures: "Not enough detail in view. Point at a wall with some texture or lighting.",
  relocalizing: "Re-finding your position — keep the phone steady.",
  notAvailable: "Depth tracking is not available right now.",
  limited: "Tracking is limited — move the phone slowly.",
};

function wallFrom(m: RegionMeasurement): Wall {
  return { lengthFt: mmToFt(m.widthMM), heightFt: mmToFt(m.heightMM), depthFt: mmToFt(m.averageDepthMM) };
}

export default function ScanScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const roomHref = `/claims/${id}/rooms/${roomId}` as Href;

  const [support, setSupport] = useState<Support>("checking");
  const [step, setStep] = useState<Step>("wallA");
  /** Where "Back" from the damage step returns to. */
  const [returnStep, setReturnStep] = useState<Step>("wallA");
  const [wallA, setWallA] = useState<Wall | null>(null);
  const [wallB, setWallB] = useState<Wall | null>(null);
  const [regions, setRegions] = useState<ScanRegion[]>([]);
  const [pending, setPending] = useState<Wall | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [tracking, setTracking] = useState("initializing");
  const [measuring, setMeasuring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  // Capability check + AR session lifecycle. The session is torn down when the screen unmounts.
  useEffect(() => {
    alive.current = true;
    let started = false;
    let sub: { remove(): void } | null = null;
    (async () => {
      const ok = await isRoomScanSupported();
      if (!alive.current) return;
      if (!ok) {
        setSupport("unsupported");
        alertNoLidar();
        return;
      }
      try {
        await startSession();
        started = true;
        sub = onDepthFrame((event) => setTracking(event.trackingState));
        if (alive.current) setSupport("ready");
      } catch (err) {
        if (!alive.current) return;
        setSupport("unsupported");
        setError(err instanceof Error ? err.message : NO_LIDAR_MESSAGE);
      }
    })();
    return () => {
      alive.current = false;
      sub?.remove();
      if (started) stopSession();
    };
  }, []);

  async function onRegion(event: { nativeEvent: RegionSelectedEvent }) {
    if (measuring || step === "review") return;
    setMeasuring(true);
    setError(null);
    try {
      const m = await measureRegion(event.nativeEvent);
      if (!m || m.widthMM <= 0 || m.heightMM <= 0) {
        setError("Couldn't read depth in that box. Make sure the surface is in view and try again.");
        return;
      }
      if (step === "damage") {
        addDamageRegion(m);
      } else {
        setPending(wallFrom(m));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Measurement failed");
    } finally {
      setMeasuring(false);
    }
  }

  function addDamageRegion(m: RegionMeasurement) {
    const region: ScanRegion = {
      label: `Damage ${regions.length + 1}`,
      widthFt: mmToFt(m.widthMM),
      heightFt: mmToFt(m.heightMM),
      areaSqFt: mm2ToSqFt(m.surfaceAreaMM2),
      depthFt: mmToFt(m.averageDepthMM),
    };
    // Alert.prompt is iOS-only, which is fine: LiDAR scanning is iOS-only too.
    Alert.prompt(
      "Label this area",
      `${formatFeet(region.widthFt)} × ${formatFeet(region.heightFt)} · ${formatArea(region.areaSqFt)}`,
      [
        { text: "Discard", style: "cancel" },
        {
          text: "Add",
          onPress: (text?: string) => setRegions((current) => [...current, { ...region, label: text?.trim() || region.label }]),
        },
      ],
      "plain-text",
      region.label,
    );
  }

  function acceptWall() {
    if (!pending) return;
    if (step === "wallA") {
      setWallA(pending);
      setStep("wallB");
    } else if (step === "wallB") {
      setWallB(pending);
      setStep("review");
    }
    setPending(null);
  }

  const dims =
    wallA && wallB
      ? {
          lengthFt: Math.max(wallA.lengthFt, wallB.lengthFt),
          widthFt: Math.min(wallA.lengthFt, wallB.lengthFt),
          heightFt: Math.round(((wallA.heightFt + wallB.heightFt) / 2) * 100) / 100,
        }
      : null;

  async function save() {
    if (!dims) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api<ScanResult>(`/api/rooms/${roomId}/scan`, {
        method: "POST",
        body: JSON.stringify({
          ...dims,
          source: "lidar",
          regions,
          unitNote: "Measured on-device with LiDAR (two-wall method). Height is the average of both walls.",
        }),
      });
      setSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the room scan");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setSaving(true);
    setError(null);
    try {
      const result = await api<ScanResult>(`/api/rooms/${roomId}/scan`, {
        method: "POST",
        body: JSON.stringify({ generate: true, source: "generated" }),
      });
      setSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not estimate the room");
    } finally {
      setSaving(false);
    }
  }

  const CameraView = support === "ready" ? getLiDARCameraView() : null;

  // ── Saved: confirmation ────────────────────────────────────────────────
  if (saved) {
    return (
      <Screen>
        <Header title="Room estimate" back={roomHref} />
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.card}>
            <Text style={styles.figure}>{formatArea(saved.areaSqFt)}</Text>
            <Text style={styles.note}>
              {formatFeet(saved.lengthFt)} × {formatFeet(saved.widthFt)} × {formatFeet(saved.heightFt)}
            </Text>
            {saved.regions?.length ? (
              <View style={styles.regionList}>
                {saved.regions.map((r, i) => (
                  <Text key={`${r.label}-${i}`} style={styles.body}>
                    {r.label} — {formatFeet(r.widthFt)} × {formatFeet(r.heightFt)} · {formatArea(r.areaSqFt)}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
          <PrimaryButton label="Done" onPress={() => router.replace(roomHref)} />
        </ScrollView>
      </Screen>
    );
  }

  // ── No LiDAR: fallback ─────────────────────────────────────────────────
  if (support !== "ready" || !CameraView) {
    return (
      <Screen>
        <Header title="Room estimate" back={roomHref} />
        <ScrollView contentContainerStyle={styles.page}>
          {support === "checking" ? (
            <Text style={styles.note}>Checking for room scanning…</Text>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Room scanning unavailable</Text>
                <Text style={styles.note}>{NO_LIDAR_MESSAGE}</Text>
              </View>
              {error ? <ErrorNote message={error} /> : null}
              <Text style={styles.note}>
                You can still store a rough placeholder estimate for this room based on its name, and replace it later from a LiDAR phone or by entering dimensions.
              </Text>
              <PrimaryButton label={saving ? "Estimating…" : "Generate placeholder estimate"} onPress={generate} disabled={saving} />
            </>
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────
  if (step === "review" && dims) {
    return (
      <Screen>
        <Header title="Room estimate" back={roomHref} />
        <ScrollView contentContainerStyle={styles.page}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Room dimensions</Text>
            <Text style={styles.figure}>{formatArea(Math.round(dims.lengthFt * dims.widthFt * 10) / 10)}</Text>
            <Text style={styles.body}>
              {formatFeet(dims.lengthFt)} long × {formatFeet(dims.widthFt)} wide × {formatFeet(dims.heightFt)} ceiling
            </Text>
            <Text style={styles.note}>
              Wall 1: {formatFeet(wallA!.lengthFt)} × {formatFeet(wallA!.heightFt)} · Wall 2: {formatFeet(wallB!.lengthFt)} × {formatFeet(wallB!.heightFt)}
            </Text>
          </View>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Damage areas</Text>
              <Pressable
                onPress={() => {
                  setReturnStep("review");
                  setStep("damage");
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>Add</Text>
              </Pressable>
            </View>
            {regions.length === 0 ? <Text style={styles.note}>None measured. Optional.</Text> : null}
            {regions.map((r, i) => (
              <View key={`${r.label}-${i}`} style={styles.rowBetween}>
                <Text style={styles.body}>
                  {r.label} — {formatFeet(r.widthFt)} × {formatFeet(r.heightFt)} · {formatArea(r.areaSqFt)}
                </Text>
                <Pressable onPress={() => setRegions((current) => current.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {error ? <ErrorNote message={error} /> : null}
          <PrimaryButton label={saving ? "Saving…" : "Save to room"} onPress={save} disabled={saving} />
          <Pressable
            style={styles.secondary}
            onPress={() => {
              setWallA(null);
              setWallB(null);
              setStep("wallA");
            }}
          >
            <Text style={styles.secondaryText}>Start over</Text>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  // ── Live scanning ──────────────────────────────────────────────────────
  const copy = STEP_COPY[step as Exclude<Step, "review">];
  const trackingHint = tracking === "normal" ? null : TRACKING_HINT[tracking] ?? TRACKING_HINT.limited;

  return (
    <Screen>
      <Header title="Scan room" back={roomHref} />
      <View style={styles.cameraWrap}>
        <CameraView style={styles.camera} showDepthOverlay={overlay} overlayOpacity={0.45} onRegionSelected={onRegion} />
        <View style={styles.banner} pointerEvents="none">
          <Text style={styles.bannerTitle}>{copy.title}</Text>
          <Text style={styles.bannerHint}>{copy.hint}</Text>
          {trackingHint ? <Text style={styles.bannerWarn}>{trackingHint}</Text> : null}
          {measuring ? <Text style={styles.bannerWarn}>Measuring…</Text> : null}
        </View>
      </View>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <Text style={styles.note}>Depth overlay</Text>
          <Switch value={overlay} onValueChange={setOverlay} />
        </View>
        {error ? <ErrorNote message={error} /> : null}
        {pending ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              Wall {formatFeet(pending.lengthFt)} wide × {formatFeet(pending.heightFt)} tall
            </Text>
            <Text style={styles.note}>Measured from {formatFeet(pending.depthFt)} away. Redraw the box to measure again.</Text>
            <PrimaryButton label={step === "wallA" ? "Use this wall · Next" : "Use this wall · Review"} onPress={acceptWall} />
          </View>
        ) : null}
        {step === "damage" ? (
          <>
            {regions.length ? <Text style={styles.note}>{regions.length} area{regions.length === 1 ? "" : "s"} measured.</Text> : null}
            <Pressable style={styles.secondary} onPress={() => setStep(returnStep)}>
              <Text style={styles.secondaryText}>{returnStep === "review" ? "Back to review" : "Back to walls"}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={styles.secondary}
            onPress={() => {
              setPending(null);
              setReturnStep(step);
              setStep("damage");
            }}
          >
            <Text style={styles.secondaryText}>Measure a damage area instead</Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 14, paddingBottom: 48 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  body: { color: colors.ink, fontSize: 15, flexShrink: 1 },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 8 },
  cardTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  figure: { fontSize: 28, fontWeight: "700", color: colors.ink },
  regionList: { gap: 4, marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  link: { color: colors.orange, fontWeight: "700" },
  remove: { color: colors.red, fontSize: 13, fontWeight: "600" },
  cameraWrap: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  banner: { position: "absolute", left: 12, right: 12, top: 12, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 12, gap: 4 },
  bannerTitle: { color: colors.white, fontWeight: "700", fontSize: 14 },
  bannerHint: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 18 },
  bannerWarn: { color: "#ffd27a", fontSize: 13, fontWeight: "600" },
  panel: { padding: 14, gap: 10, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  secondary: { borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: colors.line },
  secondaryText: { color: colors.navy, fontWeight: "700" },
});
