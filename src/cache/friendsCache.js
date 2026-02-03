// userId -> { online: [], offline: [] }
const friendsCache = new Map();

module.exports = {
  get(userId) {
    return friendsCache.get(userId);
  },

  set(userId, data) {
    friendsCache.set(userId, data);
  },

  remove(userId) {
    friendsCache.delete(userId);
  },

  updateStatus(userId, friendId, isOnline) {
    const cache = friendsCache.get(userId);
    if (!cache) return;

    if (isOnline) {
      cache.offline = cache.offline.filter(id => id !== friendId);
      if (!cache.online.includes(friendId)) cache.online.push(friendId);
    } else {
      cache.online = cache.online.filter(id => id !== friendId);
      if (!cache.offline.includes(friendId)) cache.offline.push(friendId);
    }
  }
};
