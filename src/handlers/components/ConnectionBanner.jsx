import React, { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

export default function ConnectionBanner() {
  const { socket, connected } = useWebSocket();
  const [showBanner, setShowBanner] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!socket) return;

    // ----------------------------
    // Listen to HEARTBEAT and respond with PONG
    // ----------------------------
    const heartbeatHandler = () => {
      socket.emit("pong");
    };

    socket.on("heartbeat", heartbeatHandler);

    // ----------------------------
    // Connection events
    // ----------------------------
    const onConnect = () => {
      setStatusMessage("Connected successfully ✅");
      setAttemptCount(0);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000); // Fade out success
    };

    const onDisconnect = () => {
      setStatusMessage("Connection lost ❌");
      setShowBanner(true);
      setAttemptCount((prev) => prev + 1);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("heartbeat", heartbeatHandler);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow-md z-50 transition-opacity duration-300">
      <span>{statusMessage}</span>
      {!connected && <span className="ml-2">(Attempt #{attemptCount})</span>}
    </div>
  );
}
