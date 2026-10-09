import type { QueryClient } from "@tanstack/react-query";
import type { ToastType } from "react-native-toast-notifications";
import { Notifications, type NotificationPayloads } from "@/lib/notifications";
import { bundleKey } from "@/hooks/use-bundle";

export interface HandlerContext {
  queryClient: QueryClient;
  toast: ToastType;
}

type Handler<N extends Notifications> = (payload: NotificationPayloads[N], ctx: HandlerContext) => void;

/** One handler per server notification. Each one refreshes the affected TanStack queries and tells the user. */
export const notificationHandlers: { [N in Notifications]: Handler<N> } = {
  [Notifications.imageUploadedNotification]: (payload, { queryClient, toast }) => {
    queryClient.invalidateQueries({ queryKey: bundleKey(payload.claimId) });
    queryClient.invalidateQueries({ queryKey: ["claims"] });
    toast.show(payload.hasImage ? `Photo saved — ${payload.chip}` : `${payload.chip} logged without a photo`, {
      type: "success",
      placement: "top",
    });
  },
};
