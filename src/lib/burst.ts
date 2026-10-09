import { useEffect, useState } from "react";

/** One shutter press in the current capture session. Photos stay here until the burst tray. */
export interface BurstShot {
  key: string;
  uri: string;
  claimId: string;
  roomId: string;
  chip: string;
  captionCode: string;
  photoId?: string;
  /** True after the photo is dropped on a room in the burst tray. It then leaves the selection grid. */
  placed: boolean;
  status: "saving" | "saved" | "failed";
}

let activeClaim = "";
let shots: BurstShot[] = [];
const listeners = new Set<() => void>();
const discarded = new Set<string>();
const hiddenPhotoIds = new Set<string>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Keeps the in-progress burst when the camera remounts, and starts fresh for a different claim. */
export function ensureBurst(claimId: string) {
  if (activeClaim === claimId) return;
  activeClaim = claimId;
  shots = [];
  discarded.clear();
  hiddenPhotoIds.clear();
  emit();
}

export function shotsFor(claimId: string) {
  return activeClaim === claimId ? shots : [];
}

export function addShot(shot: BurstShot) {
  if (activeClaim !== shot.claimId) {
    activeClaim = shot.claimId;
    shots = [];
  }
  shots = [...shots, shot];
  emit();
}

export function updateShot(key: string, patch: Partial<BurstShot>) {
  shots = shots.map((shot) => (shot.key === key ? { ...shot, ...patch } : shot));
  emit();
  return shots.find((shot) => shot.key === key);
}

/** Drops a burst photo immediately. A saved photo id stays hidden until the server copy is gone too. */
export function removeShot(key: string) {
  const shot = shots.find((item) => item.key === key);
  if (!shot) return;
  shots = shots.filter((item) => item.key !== key);
  discarded.add(key);
  if (shot.photoId) hiddenPhotoIds.add(shot.photoId);
  emit();
  return shot;
}

export function restoreShot(shot: BurstShot) {
  discarded.delete(shot.key);
  if (shot.photoId) hiddenPhotoIds.delete(shot.photoId);
  if (!shots.some((item) => item.key === shot.key)) shots = [...shots, shot];
  emit();
}

/** True when this shutter press was deleted before its upload finished. */
export function claimDiscarded(key: string) {
  return discarded.delete(key);
}

export function hidePhoto(id: string) {
  hiddenPhotoIds.add(id);
  emit();
}

export function unhidePhoto(id: string) {
  hiddenPhotoIds.delete(id);
  emit();
}

/** Removes the in-session copy of a photo that was already saved. */
export function removeShotByPhotoId(photoId: string) {
  const shot = shots.find((item) => item.photoId === photoId);
  if (!shot) {
    hidePhoto(photoId);
    return;
  }
  return removeShot(shot.key);
}

export function isPhotoHidden(id: string) {
  return hiddenPhotoIds.has(id);
}

export function useBurst(claimId: string) {
  const [items, setItems] = useState(() => shotsFor(claimId));
  useEffect(() => subscribe(() => setItems(shotsFor(claimId))), [claimId]);
  return items;
}
