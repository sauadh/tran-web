import React from "react";

/**
 * LiveCursor Component
 * Displays a user's cursor with label above it
 */
export default function LiveCursor({ userId, position, color }) {
  if (!position) return null;

  const { x, y } = position;

  return (
    <div
      className="absolute pointer-events-none flex flex-col items-center transition-all duration-100"
      style={{ left: x, top: y }}
    >
      <span
        className="text-xs font-semibold bg-white px-1 rounded shadow"
        style={{ color }}
      >
        {userId}
      </span>
      <div
        className="w-3 h-3 rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}
