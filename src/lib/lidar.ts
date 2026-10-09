/** Thin, crash-safe wrapper around the ExpoLidar native module.
 *
 *  The package's own JS entry (`expo-lidar`) reads `NativeModulesProxy.ExpoLidar`,
 *  which no longer exists in SDK 57, so we talk to the module directly through
 *  `requireOptionalNativeModule`. Everything here degrades to "not supported"
 *  when the native module is missing (Android, web, simulator, or a build that
 *  predates expo-lidar) instead of throwing.
 */
import { requireNativeViewManager, requireOptionalNativeModule } from "expo-modules-core";
import type { ComponentType } from "react";
import { Alert, Platform, type ViewProps } from "react-native";

export interface RegionMeasurement {
  widthMM: number;
  heightMM: number;
  surfaceAreaMM2: number;
  averageDepthMM: number;
  depthProfile: number[];
}

export interface DepthFrame {
  colorImagePath: string;
  depthMapPath: string;
  intrinsics: [number, number, number, number];
  timestamp: number;
}

export interface DepthFrameEvent {
  timestamp: number;
  depthWidth: number;
  depthHeight: number;
  averageDepthM: number;
  trackingState: string;
}

export interface RegionSelectedEvent {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiDARCameraViewProps extends ViewProps {
  showDepthOverlay?: boolean;
  overlayOpacity?: number;
  onRegionSelected?: (event: { nativeEvent: RegionSelectedEvent }) => void;
}

interface NativeLidar {
  isSupported(): Promise<boolean>;
  startSession(): Promise<void>;
  stopSession(): Promise<void>;
  captureDepthFrame(): Promise<DepthFrame | null>;
  measureRegion(x: number, y: number, width: number, height: number): Promise<RegionMeasurement | null>;
  exportMesh(x: number, y: number, width: number, height: number): Promise<string | null>;
  addListener?<T>(name: string, listener: (event: T) => void): { remove(): void };
}

export const NO_LIDAR_TITLE = "Room scanning unavailable";
export const NO_LIDAR_MESSAGE =
  "Room scanning capabilities not detected with your iPhone. LiDAR is available on iPhone Pro models (12 Pro and newer) and iPad Pro.";

const native: NativeLidar | null = Platform.OS === "ios" ? requireOptionalNativeModule<NativeLidar>("ExpoLidar") : null;

/** True only on a LiDAR-equipped iPhone/iPad running a build that includes ExpoLidar. */
export async function isRoomScanSupported(): Promise<boolean> {
  if (!native) return false;
  try {
    return Boolean(await native.isSupported());
  } catch {
    return false;
  }
}

export function alertNoLidar(onDismiss?: () => void) {
  Alert.alert(NO_LIDAR_TITLE, NO_LIDAR_MESSAGE, [{ text: "OK", onPress: onDismiss }]);
}

export async function startSession(): Promise<void> {
  if (!native) throw new Error(NO_LIDAR_MESSAGE);
  await native.startSession();
}

export async function stopSession(): Promise<void> {
  try {
    await native?.stopSession();
  } catch {
    // Session already stopped; nothing to do.
  }
}

export async function measureRegion(region: RegionSelectedEvent): Promise<RegionMeasurement | null> {
  if (!native) return null;
  return native.measureRegion(region.x, region.y, region.width, region.height);
}

export async function captureDepthFrame(): Promise<DepthFrame | null> {
  if (!native) return null;
  return native.captureDepthFrame();
}

export async function exportMesh(region: RegionSelectedEvent): Promise<string | null> {
  if (!native) return null;
  return native.exportMesh(region.x, region.y, region.width, region.height);
}

/** Subscribe to the ~10 fps depth frame stream (tracking state, center depth). */
export function onDepthFrame(listener: (event: DepthFrameEvent) => void): { remove(): void } {
  if (!native?.addListener) return { remove: () => {} };
  return native.addListener<DepthFrameEvent>("onDepthFrameCaptured", listener);
}

let cachedView: ComponentType<LiDARCameraViewProps> | null | undefined;

/** Native AR camera view, or null when the native view is not in this build. */
export function getLiDARCameraView(): ComponentType<LiDARCameraViewProps> | null {
  if (cachedView !== undefined) return cachedView;
  if (!native) {
    cachedView = null;
    return cachedView;
  }
  try {
    cachedView = requireNativeViewManager<LiDARCameraViewProps>("LiDARCameraView");
  } catch {
    cachedView = null;
  }
  return cachedView;
}

const MM_PER_FT = 304.8;

export function mmToFt(mm: number): number {
  return Math.round((mm / MM_PER_FT) * 100) / 100;
}

export function mm2ToSqFt(mm2: number): number {
  return Math.round((mm2 / (MM_PER_FT * MM_PER_FT)) * 10) / 10;
}
