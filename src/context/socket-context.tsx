import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/context/user-context";
import { API_URL } from "@/lib/api";

interface ISocketContext {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<ISocketContext>({ socket: null, connected: false });

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Keeps one authenticated Socket.IO connection alive while the user is signed in.
 * The token is read from storage on every (re)connect so a refreshed access token is picked up automatically.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const next = io(API_URL, {
      transports: ["websocket"],
      auth: (cb) => {
        AsyncStorage.getItem("@token").then((token) => cb({ token: token ?? accessToken }));
      },
    });

    next.on("connect", () => setConnected(true));
    next.on("disconnect", () => setConnected(false));
    next.on("connect_error", (err) => {
      // EXPIRED_TOKEN resolves itself: the next REST call refreshes the token and the auto-reconnect re-reads it.
      if (err.message !== "EXPIRED_TOKEN") console.warn("[socket] connect error:", err.message);
    });

    setSocket(next);
    return () => {
      next.removeAllListeners();
      next.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}
