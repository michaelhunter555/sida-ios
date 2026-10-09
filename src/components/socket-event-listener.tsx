import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useToast } from "react-native-toast-notifications";
import { useSocket } from "@/context/socket-context";
import { notificationHandlers } from "@/lib/notification-handlers";
import { Notifications } from "@/lib/notifications";

/** Subscribes the active socket to every notification in the enum and routes each to its handler. Renders nothing. */
export function SocketEventListener() {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;
    const ctx = { queryClient, toast };
    const names = Object.values(Notifications);
    for (const name of names) {
      socket.on(name, (payload) => notificationHandlers[name](payload, ctx));
    }
    return () => {
      for (const name of names) socket.off(name);
    };
  }, [socket, queryClient, toast]);

  return null;
}
