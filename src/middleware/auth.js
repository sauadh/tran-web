// middleware/auth.js

const jwt = require("jsonwebtoken");

/**
 * Socket.IO authentication middleware
 * @param {Socket} socket 
 * @param {Function} next 
 */
const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication error: Token not provided"));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || "secret");

    // Store userId in socket data
    socket.data.userId = payload.userId;

    return next();
  } catch (err) {
    console.error("Socket authentication failed:", err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = authenticateSocket;
