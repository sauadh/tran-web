import React, { useMemo } from "react";
import { useCollaboration } from "../hooks/useCollaboration";
import LiveCursor from "./LiveCursor";

// Predefined colors for users
const USER_COLORS = [
  "#EF4444", // red
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
];

export default function CollaborationBar({ entryId }) {
  const { viewers, cursors } = useCollaboration(entryId);

  // Assign consistent color per user
  const userColorMap = useMemo(() => {
    const map = {};
    viewers.forEach((v, index) => {
      map[v.userId] = USER_COLORS[index % USER_COLORS.length];
    });
    return map;
  }, [viewers]);

  return (
    <div className="relative w-full h-full">
      {/* Viewer Avatars */}
      <div className="flex space-x-2 mb-2">
        {viewers.map((v) => (
          <div
            key={v.userId}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ backgroundColor: userColorMap[v.userId] }}
          >
            {v.userId.slice(0, 2).toUpperCase()}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {viewers.length} viewer{viewers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Live cursors */}
      {Object.entries(cursors).map(([userId, cursor]) => (
        <LiveCursor
          key={userId}
          userId={userId}
          position={cursor.position}
          color={userColorMap[userId] || "#000"}
        />
      ))}
    </div>
  );
}
