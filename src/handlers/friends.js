const pool = require("../db/connection");
const MessageFormatter = require("../utils/messageFormatter");
const DIARY_SOCIAL_WS_EVENTS = require("../constants/diarySocialWsEvent");
const friendsCache = require("../cache/friendsCache");

async function sendFriendsList(socket, userId) {
  const cached = friendsCache.get(userId);
  if (cached) {
    socket.emit(
      DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
      MessageFormatter.create(
        DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
        cached
      )
    );
    return;
  }

  const { rows } = await pool.query(
    `
    SELECT f.friend_id, COALESCE(w.online, false) AS online
    FROM friends f
    LEFT JOIN ws_connections w ON w.user_id = f.friend_id
    WHERE f.user_id = $1
    `,
    [userId]
  );

  const onlineFriends = [];
  const offlineFriends = [];

  rows.forEach(r => {
    r.online ? onlineFriends.push(r.friend_id) : offlineFriends.push(r.friend_id);
  });

  const result = { onlineFriends, offlineFriends };
  friendsCache.set(userId, result);

  socket.emit(
    DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
    MessageFormatter.create(
      DIARY_SOCIAL_WS_EVENTS.FRIENDS_LIST,
      result
    )
  );
}

module.exports = { sendFriendsList };
