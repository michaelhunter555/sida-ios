import { isPhotoHidden, type BurstShot } from "./burst";
import { chipsForRoom } from "./chip-sets";
import type { ClaimType, Photo, Room } from "./types";

type CoverRoom = Pick<Room, "id" | "name" | "section" | "slopeCode" | "triggers">;

/** How many of a room's chips already have a photo, counting saved photos and this capture session. */
export function roomCoverage(claimType: ClaimType, room: CoverRoom, photos: Photo[], shots: BurstShot[]) {
  const chips = chipsForRoom(claimType, room);
  const labels = new Set(chips.map((chip) => chip.label));
  const covered = new Set<string>();
  for (const photo of photos) {
    if (photo.deletedAt || isPhotoHidden(photo.id) || photo.roomId !== room.id || !labels.has(photo.chip)) continue;
    covered.add(photo.chip);
  }
  for (const shot of shots) {
    if (shot.roomId !== room.id || !labels.has(shot.chip)) continue;
    covered.add(shot.chip);
  }
  return { chips, covered, taken: covered.size, total: chips.length };
}
