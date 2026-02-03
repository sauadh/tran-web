const pool = require("../db/connection");
const DIARY_SOCIAL_WS_EVENTS = require("../constants/diarySocialWsEvent");
const friendsCache = require("../cache/friendsCache");

/**
 * Set a user as online and notify their friends
 */
async function setUserOnline(userId, socketId, io) {
  try {
    // Update or insert connection
    await pool.query(
      `
      INSERT INTO ws_connections(user_id, socket_id, online, last_seen)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT(user_id) DO UPDATE
      SET socket_id = $2, online = true, last_seen = NOW()
      `,
      [userId, socketId]
    );

    // Get friends who should be notified
    const { rows } = await pool.query(
      `SELECT user_id FROM friends WHERE friend_id = $1`,
      [userId]
    );

    // Notify each friend that this user is online
    rows.forEach((r) => {
      // Update cache
      friendsCache.updateStatus(r.user_id, userId, true);
      
      // Emit to friend's socket
      io.to(r.user_id).emit(DIARY_SOCIAL_WS_EVENTS.FRIEND_ONLINE, {
        userId,
        timestamp: Date.now(),
      });
    });

    console.log(`✅ ${userId} is now online`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error setting user online:`, err);
    throw err;
  }
}

/**
 * Set a user as offline and notify their friends
 */
async function setUserOffline(userId, io) {
  try {
    // Update connection status
    await pool.query(
      `UPDATE ws_connections 
       SET online = false, last_seen = NOW() 
       WHERE user_id = $1`,
      [userId]
    );

    // Get friends who should be notified
    const { rows } = await pool.query(
      `SELECT user_id FROM friends WHERE friend_id = $1`,
      [userId]
    );

    // Notify each friend that this user is offline
    rows.forEach((r) => {
      // Update cache
      friendsCache.updateStatus(r.user_id, userId, false);
      
      // Emit to friend's socket
      io.to(r.user_id).emit(DIARY_SOCIAL_WS_EVENTS.FRIEND_OFFLINE, {
        userId,
        timestamp: Date.now(),
      });
    });

    console.log(`❌ ${userId} is now offline`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error setting user offline:`, err);
    throw err;
  }
}

/**
 * Get online friends for a user
 */
async function getOnlineFriends(userId) {
  try {
    const res = await pool.query(
      `
      SELECT f.friend_id, w.socket_id, w.online
      FROM friends f
      LEFT JOIN ws_connections w ON w.user_id = f.friend_id
      WHERE f.user_id = $1 AND w.online = true
      `,
      [userId]
    );
    return res.rows;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching online friends:`, err);
    return [];
  }
}

module.exports = {
  setUserOnline,
  setUserOffline,
  getOnlineFriends,
};