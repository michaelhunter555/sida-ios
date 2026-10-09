/** Realtime notification names received over Socket.IO. Keep in sync with sida-server/src/lib/notifications.ts. */
export enum Notifications {
  imageUploadedNotification = "imageuploadednotifications",
}

export interface ImageUploadedPayload {
  photoId: string;
  claimId: string;
  roomId: string | null;
  chip: string;
  hasImage: boolean;
}

export interface NotificationPayloads {
  [Notifications.imageUploadedNotification]: ImageUploadedPayload;
}
