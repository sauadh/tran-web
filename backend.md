# WebSocket Server - Backend Documentation

## Project Overview

This is a real-time WebSocket server built with **Socket.IO** for a collaborative diary application. It handles:
- Real-time collaboration on diary entries
- User presence tracking (online/offline status)
- Live notifications system
- Real-time cursor tracking for collaborative editing
- Friend connections and social features

## Technology Stack

- **Node.js** - Runtime environment
- **Express.js** (v5.2.1) - HTTP server framework
- **Socket.IO** (v4.8.3) - WebSocket implementation
- **PostgreSQL** (via pg v8.17.2) - Database
- **JWT** (jsonwebtoken v9.0.3) - Authentication
- **dotenv** - Environment configuration

## Architecture Overview

```
┌─────────────────┐
│   Client/Web    │
│    Frontend     │
└────────┬────────┘
         │ WebSocket (Socket.IO)
         │ Path: /realtime/ws
         ↓
┌─────────────────┐
│  Socket.IO      │
│  Server (8003)  │
│  + Auth Layer   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   PostgreSQL    │
│    Database     │
└─────────────────┘
```

## Core Features

### 1. Authentication & Connection Management
- JWT-based socket authentication
- Automatic reconnection handling
- Session persistence across reconnects
- Heartbeat/keepalive mechanism (30s intervals)
- Stale connection cleanup (2-minute timeout)

### 2. User Presence System
- Online/Offline status tracking
- Friend list synchronization
- Real-time presence notifications
- Active session management

### 3. Real-Time Collaboration
- Multi-user diary entry editing
- Live cursor position tracking
- State synchronization
- Conflict detection and resolution
- Entry room management (join/leave)

### 4. Notifications System
- Real-time notification delivery
- Read/unread tracking
- Notification preferences
- Archive functionality
- Multiple notification types (comments, friend requests, mentions, etc.)

### 5. Rate Limiting
- 10 events per second per user
- Prevents spam and abuse
- Graceful degradation

## Server Configuration

### Environment Variables

```env
PORT=8003                    # Server port
DATABASE_URL=                # PostgreSQL connection string
JWT_SECRET=                  # JWT secret for authentication
NODE_ENV=production          # Environment (development/production)
```

### Server Endpoints

**WebSocket Connection:**
- URL: `ws://your-server:8003/realtime/ws`
- Protocol: Socket.IO v4

**HTTP Health Check:**
- URL: `http://your-server:8003/health`
- Method: GET
- Response: `{ status: "ok", connections: number, timestamp: string }`

## WebSocket Events

### System Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Server → Client | Socket connected successfully |
| `authenticated` | Server → Client | User authenticated, sends userId |
| `disconnect` | Bidirectional | Connection closed |
| `heartbeat` | Server → Client | Keepalive ping (every 30s) |
| `pong` | Client → Server | Heartbeat response |
| `error` | Server → Client | Error occurred with code & message |

### Presence Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `online` | Server → Client | User came online |
| `offline` | Server → Client | User went offline |
| `friend_online` | Server → Client | A friend came online |
| `presence_update` | Server → Client | User presence changed |

### Collaboration Events (Diary Entries)

| Event | Direction | Description | Payload |
|-------|-----------|-------------|---------|
| `join_entry_room` | Client → Server | Join a diary entry session | `{ entryId: string }` |
| `leave_entry_room` | Client → Server | Leave a diary entry session | `{ entryId: string }` |
| `entry_edit` | Bidirectional | Real-time text changes | `{ entryId, delta, userId, timestamp }` |
| `entry_cursor_move` | Bidirectional | Cursor position update | `{ entryId, userId, position, selection }` |
| `entry_cursor_clear` | Server → Client | User left/disconnected | `{ entryId, userId }` |
| `current_viewers` | Server → Client | List of active viewers | `{ entryId, viewers: [] }` |
| `state_request` | Client → Server | Request full entry state | `{ entryId }` |
| `state_response` | Server → Client | Full entry state | `{ entryId, content, cursors }` |
| `desync_detected` | Client → Server | Client detected sync issue | `{ entryId }` |

### Notification Events

| Event | Direction | Description | Payload |
|-------|-----------|-------------|---------|
| `notification:created` | Server → Client | New notification | Notification object |
| `notification:mark_read` | Client → Server | Mark as read | `{ notificationId }` |
| `notification:mark_all_read` | Client → Server | Mark all as read | - |
| `notification:list_request` | Client → Server | Get notifications | `{ limit, offset, filter }` |
| `notification:list_response` | Server → Client | Notification list | `{ notifications: [], total }` |
| `notification:count_request` | Client → Server | Get unread count | - |
| `notification:count_response` | Server → Client | Unread count | `{ count: number }` |

## Database Schema

### Key Tables

```sql
-- User connections tracking
CREATE TABLE ws_connections (
    user_id UUID PRIMARY KEY,
    socket_id VARCHAR(255),
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Active collaboration sessions
CREATE TABLE active_sessions (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    entry_id UUID,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID,
    type VARCHAR(50),
    title TEXT,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Friends relationships
CREATE TABLE friends (
    user_id UUID,
    friend_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id)
);
```

## Connection Flow

### 1. Client Connection

```javascript
// Client connects with JWT token
const socket = io('http://localhost:8003/realtime/ws', {
  path: '/realtime/ws',
  auth: {
    token: 'your-jwt-token'
  }
});

// Listen for authentication
socket.on('authenticated', ({ userId, timestamp }) => {
  console.log('Connected as:', userId);
});
```

### 2. Join Entry for Collaboration

```javascript
// Join a diary entry room
socket.emit('join_entry_room', { entryId: 'entry-uuid' });

// Listen for other users' edits
socket.on('entry_edit', ({ userId, delta, timestamp }) => {
  // Apply changes to your editor
});

// Send your edits
socket.emit('entry_edit', {
  entryId: 'entry-uuid',
  delta: { ops: [...] },
  timestamp: Date.now()
});
```

### 3. Cursor Tracking

```javascript
// Send cursor position
socket.emit('entry_cursor_move', {
  entryId: 'entry-uuid',
  position: { index: 42, length: 5 },
  selection: { start: 42, end: 47 }
});

// Receive other users' cursors
socket.on('entry_cursor_move', ({ userId, position, selection }) => {
  // Display cursor in editor
});
```

### 4. Notifications

```javascript
// Request notifications
socket.emit('notification:list_request', {
  limit: 20,
  offset: 0,
  filter: { unread: true }
});

// Receive notifications
socket.on('notification:list_response', ({ notifications, total }) => {
  // Display notifications
});

// Mark as read
socket.emit('notification:mark_read', { notificationId: 'notif-uuid' });
```

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_ERROR` | Authentication failed |
| `VALIDATION_ERROR` | Invalid input data |
| `SERVER_ERROR` | Internal server error |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `ACCESS_DENIED` | Permission denied |

### Error Event Format

```javascript
socket.on('error', ({ code, message }) => {
  console.error(`Error [${code}]:`, message);
});
```

## Rate Limiting

- **Limit:** 10 events per second per user
- **Window:** 1 second rolling window
- **Action:** Events beyond limit are dropped
- **Notification:** Client receives rate limit error

## Performance Optimizations

1. **In-Memory Stores:**
   - Connected users map (userId → socketId)
   - Cursor store (entryId → Map(userId → cursorData))

2. **Cleanup Intervals:**
   - Stale sockets: Every 1 minute
   - Database sessions: Every 5 minutes
   - Heartbeat: Every 30 seconds

3. **Database Connection Pooling:**
   - Uses pg connection pool
   - Efficient query execution

## Security Features

1. **JWT Authentication:**
   - Every socket must authenticate
   - Token validation on connection

2. **Rate Limiting:**
   - Prevents spam and abuse
   - Per-user limits

3. **Input Validation:**
   - All events validate required fields
   - Type checking on inputs

4. **CORS Configuration:**
   - Configurable origins
   - Credentials support

## Monitoring & Health

### Health Check Endpoint

```bash
curl http://localhost:8003/health
```

Response:
```json
{
  "status": "ok",
  "connections": 42,
  "timestamp": "2025-02-09T10:30:00.000Z"
}
```

### Logging

The server logs:
- User connections/disconnections
- Room joins/leaves
- Errors with timestamps
- Cleanup operations
- State sync requests

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Environment Setup

1. Create `.env` file with required variables
2. Set up PostgreSQL database
3. Run database migrations (schema.sql)
4. Start the server

## Testing

### Manual Testing with Socket.IO Client

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:8003/realtime/ws', {
  auth: { token: 'your-test-jwt' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('authenticated', (data) => console.log('Auth:', data));
```

## Common Issues & Solutions

### Issue: "JWT malformed"
**Solution:** Ensure token is passed correctly in auth object

### Issue: Connections drop frequently
**Solution:** Check heartbeat/pong implementation on client

### Issue: State desynchronization
**Solution:** Implement state_request/response cycle

### Issue: High memory usage
**Solution:** Ensure proper cleanup of cursor store and sessions

## Scaling Considerations

For production at scale, consider:

1. **Redis Adapter** for Socket.IO
   - Enable multi-server deployment
   - Shared state across instances

2. **Load Balancer** with sticky sessions
   - Maintain WebSocket connections
   - Session affinity

3. **Database Read Replicas**
   - Reduce database load
   - Improve query performance

4. **Monitoring**
   - Application performance monitoring (APM)
   - Error tracking
   - Connection metrics

## Key Files Reference

- `src/server.js` - Main server file
- `src/middleware/auth.js` - JWT authentication
- `src/handlers/collaboration.js` - Collaboration logic
- `src/handlers/notification.js` - Notification system
- `src/handlers/presence.js` - Presence tracking
- `src/constants/*` - Event definitions
- `src/db/schema.sql` - Database schema

---

**Version:** 1.0.0  
**Last Updated:** February 2025
