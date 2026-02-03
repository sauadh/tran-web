require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const pool = require("./db/connection");
const authenticateSocket = require("./middleware/auth");

const WS_EVENTS = require("./constants/wsEvents");
const DIARY_SOCIAL_WS_EVENTS = require("./constants/diarySocialWsEvent");
const DIARY_COLLAB_WS_EVENTS = require("./constants/diaryCollabWsEvents");

const { setUserOnline, setUserOffline } = require("./handlers/presence");
const { sendFriendsList } = require("./handlers/friends");
const {
  registerCollaborationHandlers,
  clearCursor,
  handleStateRequest,
  joinEntryRoom,
  leaveEntryRoom,
} = require("./handlers/collaboration");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || "*",
    credentials: true 
  } 
});

// ============================================
// Rate Limiting
// ============================================
const RATE_LIMIT = 10; // max events per second
const userEventCounts = new Map(); // userId -> { count, lastReset }

function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 1000; // 1 second window

  let data = userEventCounts.get(userId);

  if (!data) {
    data = { count: 0, lastReset: now };
    userEventCounts.set(userId, data);
  }

  if (now - data.lastReset > windowMs) {
    data.count = 0;
    data.lastReset = now;
  }

  data.count += 1;
  if (data.count > RATE_LIMIT) return false;
  return true;
}

// ============================================
// Middleware
// ============================================
io.use(authenticateSocket);

// ============================================
// In-memory stores
// ============================================
const connectedUsers = {}; // userId -> socket.id
const cursorStore = new Map(); // entryId -> Map(userId -> cursorData)

// ============================================
// Heartbeat and Cleanup
// ============================================
const HEARTBEAT_INTERVAL = 30 * 1000;
const STALE_TIMEOUT = 2 * 60 * 1000;

// Emit heartbeat every 30 seconds
setInterval(() => {
  io.emit(WS_EVENTS.HEARTBEAT, { timestamp: Date.now() });
}, HEARTBEAT_INTERVAL);

// Cleanup stale sockets every minute
setInterval(async () => {
  const now = Date.now();
  for (const socket of io.sockets.sockets.values()) {
    if (!socket.lastHeartbeatReceived) continue;
    if (now - socket.lastHeartbeatReceived > STALE_TIMEOUT) {
      console.log(`⚠️ Stale socket disconnected: ${socket.data.userId}`);
      await setUserOffline(socket.data.userId, io);
      socket.disconnect(true);
    }
  }
}, 60 * 1000);

// Cleanup stale sessions every 5 minutes
setInterval(async () => {
  try {
    const res = await pool.query(`
      DELETE FROM active_sessions
      WHERE last_seen < NOW() - INTERVAL '10 minutes'
    `);
    console.log(`🧹 Cleaned up ${res.rowCount} stale sessions`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Cleanup error:`, err);
  }
}, 5 * 60 * 1000);

// ============================================
// Socket Connection Handler
// ============================================
io.on("connection", async (socket) => {
  const userId = socket.data.userId;
  
  if (!userId) {
    socket.emit(WS_EVENTS.ERROR, { 
      code: "AUTH_ERROR", 
      message: "Missing userId" 
    });
    return socket.disconnect();
  }

  socket.lastHeartbeatReceived = Date.now();
  connectedUsers[userId] = socket.id;

  console.log(`✅ Connected: ${userId} [${socket.id}]`);

  try {
    // Mark user online
    await setUserOnline(userId, socket.id, io);

    // Send friends list
    await sendFriendsList(socket, userId);

    // Notify online friends
    const friends = await pool.query(
      `SELECT friend_id FROM friends WHERE user_id = $1`,
      [userId]
    );

    friends.rows.forEach((f) => {
      const friendSocket = connectedUsers[f.friend_id];
      if (friendSocket) {
        io.to(friendSocket).emit(
          DIARY_SOCIAL_WS_EVENTS.FRIEND_ONLINE,
          { userId, timestamp: Date.now() }
        );
      }
    });

    // Restore previous sessions
    const sessions = await pool.query(
      `SELECT entry_id FROM active_sessions WHERE user_id = $1`,
      [userId]
    );

    sessions.rows.forEach((row) => {
      socket.join(`entry_${row.entry_id}`);
      console.log(`🔄 Restored session for entry ${row.entry_id}`);
    });

    // Emit authenticated event
    socket.emit(WS_EVENTS.AUTHENTICATED, { 
      userId, 
      timestamp: Date.now() 
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Connection error:`, err);
    socket.emit(WS_EVENTS.ERROR, { 
      code: "SERVER_ERROR", 
      message: "Connection failed" 
    });
  }

  // ============================================
  // HEARTBEAT PONG Handler
  // ============================================
  socket.on(WS_EVENTS.PONG, async () => {
    socket.lastHeartbeatReceived = Date.now();
    try {
      await pool.query(
        `UPDATE ws_connections SET last_seen = NOW() WHERE user_id = $1`,
        [userId]
      );
      await pool.query(
        `UPDATE active_sessions SET last_seen = NOW() WHERE user_id = $1`,
        [userId]
      );
    } catch (err) {
      console.error(`[${new Date().toISOString()}] PONG error:`, err);
    }
  });

  // ============================================
  // JOIN_ENTRY_ROOM Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.JOIN_ENTRY_ROOM, async ({ entryId }) => {
    try {
      if (!entryId) {
        socket.emit(WS_EVENTS.ERROR, { 
          code: "VALIDATION_ERROR", 
          message: "entryId is required" 
        });
        return;
      }

      await joinEntryRoom(io, socket, userId, entryId);
      console.log(`👥 ${userId} joined entry_${entryId}`);

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Join room error:`, err);
      socket.emit(WS_EVENTS.ERROR, { 
        code: err.code || "SERVER_ERROR", 
        message: err.message 
      });
    }
  });

  // ============================================
  // LEAVE_ENTRY_ROOM Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.LEAVE_ENTRY_ROOM, async ({ entryId }) => {
    try {
      if (!entryId) return;
      await leaveEntryRoom(io, socket, userId, entryId, cursorStore);
      console.log(`👋 ${userId} left entry_${entryId}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Leave room error:`, err);
    }
  });

  // ============================================
  // STATE_REQUEST Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.STATE_REQUEST, async ({ entryId }) => {
    try {
      if (!entryId) return;
      await handleStateRequest(io, socket, userId, entryId);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] State request error:`, err);
      socket.emit(WS_EVENTS.ERROR, { 
        code: "SERVER_ERROR", 
        message: "Failed to fetch state" 
      });
    }
  });

  // ============================================
  // DESYNC_DETECTED Handler
  // ============================================
  socket.on(DIARY_COLLAB_WS_EVENTS.DESYNC_DETECTED, async ({ entryId }) => {
    try {
      if (!entryId) return;
      console.log(`⚠️ Desync detected by ${userId} on entry ${entryId}`);
      await handleStateRequest(io, socket, userId, entryId);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Desync handler error:`, err);
    }
  });

  // ============================================
  // Register Collaboration Handlers
  // (ENTRY_EDIT, CURSOR_MOVE, etc.)
  // ============================================
  registerCollaborationHandlers(io, socket, cursorStore, checkRateLimit);

  // ============================================
  // DISCONNECT Handler
  // ============================================
  socket.on("disconnect", async (reason) => {
    console.log(`⚡ User disconnected: ${userId}, reason: ${reason}`);

    delete connectedUsers[userId];

    try {
      await setUserOffline(userId, io);

      // Clear all cursors for this user
      for (const [entryId, cursors] of cursorStore.entries()) {
        if (cursors.has(userId)) {
          cursors.delete(userId);
          socket.to(`entry_${entryId}`).emit(
            DIARY_COLLAB_WS_EVENTS.ENTRY_CURSOR_CLEAR,
            { userId, entryId }
          );
        }
      }

      // Clean up active sessions
      await pool.query(
        `DELETE FROM active_sessions WHERE user_id = $1`,
        [userId]
      );

    } catch (err) {
      console.error(`[${new Date().toISOString()}] Disconnect error:`, err);
    }
  });
});

// ============================================
// Health Check Endpoint
// ============================================
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// Start Server
// ============================================
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});