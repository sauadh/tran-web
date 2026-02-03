import React from "react";
import { usePresence } from "../hooks/usePresence";

/**
 * UserBadge component
 * Shows a small avatar/initial with online/offline dot
 */
function UserBadge({ userId, isOnline }) {
  // Generate initials from userId (replace with real names if available)
  const initials = userId.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center space-x-2">
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold">
          {initials}
        </div>
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
        />
      </div>
      <span className="text-sm">{userId}</span>
    </div>
  );
}

/**
 * OnlineStatus component
 * Displays all online users from usePresence
 */
export default function OnlineStatus() {
  const { onlineUsers, offlineUsers } = usePresence();

  return (
    <div className="p-4 bg-white shadow rounded-lg w-64">
      <h3 className="font-semibold text-gray-700 mb-2">Online Users</h3>
      <div className="flex flex-col space-y-2">
        {onlineUsers.map((userId) => (
          <UserBadge key={userId} userId={userId} isOnline={true} />
        ))}
        {offlineUsers.map((userId) => (
          <UserBadge key={userId} userId={userId} isOnline={false} />
        ))}
      </div>
    </div>
  );
}
