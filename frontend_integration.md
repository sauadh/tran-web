# Frontend Integration Guide

## Overview

This guide explains how to integrate the WebSocket server with your frontend application. The frontend team should implement the client-side logic to communicate with the backend WebSocket server.

## Prerequisites

- Node.js and npm installed
- Basic understanding of WebSocket/Socket.IO
- JWT authentication token from your auth system

## Installation

Install the Socket.IO client library in your frontend project:

```bash
npm install socket.io-client
```

## Files to Delete from Backend Project

The following files in the backend are **NOT needed for deployment** and should be deleted before sharing with your frontend team:

### Delete These Directories:
```
ws-server/node_modules/          # Large, will be reinstalled
ws-server/src/handlers/components/   # React components (frontend responsibility)
ws-server/src/handlers/hooks/        # React hooks (frontend responsibility)
```

### Delete These Files:
```
ws-server/src/handlers/components/CollaborationBar.jsx
ws-server/src/handlers/components/ConnectionBanner.jsx
ws-server/src/handlers/components/LiveCurserBar.jsx
ws-server/src/handlers/components/NotificationBell.jsx
ws-server/src/handlers/components/OnlineStatus.jsx
ws-server/src/handlers/hooks/useCollaboration.js
ws-server/src/handlers/hooks/useNotifications.js
ws-server/src/handlers/hooks/usePresence.js
ws-server/src/handlers/hooks/useWebSocket.js
ws-server/test.js                # Test file, not needed
ws-server/.env                   # Never share .env files
```

## What to Share with Frontend Team

### Share These:
1. **Backend Documentation** (BACKEND_DOCUMENTATION.md)
2. **This Integration Guide** (FRONTEND_INTEGRATION_GUIDE.md)
3. **Event Constants** (src/constants/*.js)
4. **API Reference** (sections below)

### Do NOT Share:
- node_modules/
- .env file
- Database credentials
- JWT secrets

## Connection Setup

### 1. Create WebSocket Service

Create a `websocketService.js` file in your frontend:

```javascript
// websocketService.js
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io('http://your-backend-url:8003/realtime/ws', {
      path: '/realtime/ws',
      auth: {
        token: token // JWT token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.setupListeners();
    return this.socket;
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
    });

    this.socket.on('authenticated', ({ userId, timestamp }) => {
      console.log('✅ Authenticated as:', userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('⚠️ WebSocket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('error', ({ code, message }) => {
      console.error(`❌ WebSocket error [${code}]:`, message);
    });

    // Setup heartbeat response
    this.socket.on('heartbeat', ({ timestamp }) => {
      this.socket.emit('pong');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export default new WebSocketService();
```

### 2. Initialize in Your App

```javascript
// App.js or main component
import React, { useEffect } from 'react';
import wsService from './services/websocketService';

function App() {
  useEffect(() => {
    // Get JWT token from your auth system
    const token = localStorage.getItem('authToken');
    
    if (token) {
      wsService.connect(token);
    }

    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}

export default App;
```

## Feature Implementation

### 1. User Presence (Online/Offline Status)

```javascript
// usePresence.js - Custom Hook
import { useState, useEffect } from 'react';
import wsService from '../services/websocketService';

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    const handleFriendOnline = ({ userId, timestamp }) => {
      setOnlineUsers(prev => new Set([...prev, userId]));
    };

    const handleFriendOffline = ({ userId, timestamp }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    };

    wsService.on('friend_online', handleFriendOnline);
    wsService.on('friend_offline', handleFriendOffline);

    return () => {
      wsService.off('friend_online', handleFriendOnline);
      wsService.off('friend_offline', handleFriendOffline);
    };
  }, []);

  return { onlineUsers };
}
```

**Usage in Component:**

```javascript
import { usePresence } from './hooks/usePresence';

function FriendsList({ friends }) {
  const { onlineUsers } = usePresence();

  return (
    <div>
      {friends.map(friend => (
        <div key={friend.id}>
          {friend.name}
          {onlineUsers.has(friend.id) && (
            <span className="online-indicator">🟢 Online</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

### 2. Real-Time Notifications

```javascript
// useNotifications.js - Custom Hook
import { useState, useEffect } from 'react';
import wsService from '../services/websocketService';

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Request initial notifications
    wsService.emit('notification:list_request', {
      limit: 50,
      offset: 0,
      filter: { unread: true }
    });

    // Request unread count
    wsService.emit('notification:count_request');

    // Listen for new notifications
    wsService.on('notification:created', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for notification list
    wsService.on('notification:list_response', ({ notifications, total }) => {
      setNotifications(notifications);
    });

    // Listen for count updates
    wsService.on('notification:count_response', ({ count }) => {
      setUnreadCount(count);
    });

    return () => {
      wsService.off('notification:created');
      wsService.off('notification:list_response');
      wsService.off('notification:count_response');
    };
  }, []);

  const markAsRead = (notificationId) => {
    wsService.emit('notification:mark_read', { notificationId });
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    wsService.emit('notification:mark_all_read');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
}
```

**Usage in Component:**

```javascript
import { useNotifications } from './hooks/useNotifications';

function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="notification-bell">
      <button onClick={() => setIsOpen(!isOpen)}>
        🔔 {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      
      {isOpen && (
        <div className="notification-dropdown">
          <div className="header">
            <h3>Notifications</h3>
            <button onClick={markAllAsRead}>Mark all as read</button>
          </div>
          
          <div className="list">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={notif.is_read ? 'read' : 'unread'}
                onClick={() => markAsRead(notif.id)}
              >
                <h4>{notif.title}</h4>
                <p>{notif.message}</p>
                <span>{new Date(notif.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Real-Time Collaboration (Diary Entry Editor)

```javascript
// useCollaboration.js - Custom Hook
import { useState, useEffect, useRef } from 'react';
import wsService from '../services/websocketService';

export function useCollaboration(entryId) {
  const [viewers, setViewers] = useState([]);
  const [cursors, setCursors] = useState(new Map());
  const editorRef = useRef(null);

  useEffect(() => {
    if (!entryId) return;

    // Join the entry room
    wsService.emit('join_entry_room', { entryId });

    // Listen for current viewers
    wsService.on('current_viewers', ({ viewers: viewerList }) => {
      setViewers(viewerList);
    });

    // Listen for user joining
    wsService.on('entry_collab_join', ({ userId, username }) => {
      setViewers(prev => [...prev, { userId, username }]);
    });

    // Listen for user leaving
    wsService.on('entry_collab_leave', ({ userId }) => {
      setViewers(prev => prev.filter(v => v.userId !== userId));
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(userId);
        return newCursors;
      });
    });

    // Listen for remote edits
    wsService.on('entry_edit', ({ userId, delta, timestamp }) => {
      if (editorRef.current) {
        // Apply delta to your editor (e.g., Quill, ProseMirror, etc.)
        editorRef.current.updateContents(delta);
      }
    });

    // Listen for cursor movements
    wsService.on('entry_cursor_move', ({ userId, position, selection }) => {
      setCursors(prev => new Map(prev).set(userId, { position, selection }));
    });

    // Listen for cursor clear
    wsService.on('entry_cursor_clear', ({ userId }) => {
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.delete(userId);
        return newCursors;
      });
    });

    return () => {
      // Leave the room on unmount
      wsService.emit('leave_entry_room', { entryId });
      wsService.off('current_viewers');
      wsService.off('entry_collab_join');
      wsService.off('entry_collab_leave');
      wsService.off('entry_edit');
      wsService.off('entry_cursor_move');
      wsService.off('entry_cursor_clear');
    };
  }, [entryId]);

  const sendEdit = (delta) => {
    wsService.emit('entry_edit', {
      entryId,
      delta,
      timestamp: Date.now()
    });
  };

  const sendCursorPosition = (position, selection) => {
    wsService.emit('entry_cursor_move', {
      entryId,
      position,
      selection
    });
  };

  return {
    viewers,
    cursors,
    editorRef,
    sendEdit,
    sendCursorPosition
  };
}
```

**Usage in Editor Component:**

```javascript
import { useCollaboration } from './hooks/useCollaboration';
import ReactQuill from 'react-quill'; // Example editor

function DiaryEditor({ entryId }) {
  const [content, setContent] = useState('');
  const { viewers, cursors, editorRef, sendEdit, sendCursorPosition } = 
    useCollaboration(entryId);

  const handleChange = (value, delta, source, editor) => {
    if (source === 'user') {
      setContent(value);
      sendEdit(delta);
    }
  };

  const handleSelectionChange = (range, source, editor) => {
    if (range && source === 'user') {
      sendCursorPosition(
        { index: range.index, length: range.length },
        { start: range.index, end: range.index + range.length }
      );
    }
  };

  return (
    <div className="editor-container">
      <div className="collaboration-bar">
        <span>Currently viewing: {viewers.length}</span>
        {viewers.map(v => (
          <span key={v.userId} className="viewer-avatar">
            {v.username}
          </span>
        ))}
      </div>

      <ReactQuill
        ref={editorRef}
        value={content}
        onChange={handleChange}
        onChangeSelection={handleSelectionChange}
      />

      {/* Render remote cursors */}
      {Array.from(cursors.entries()).map(([userId, cursor]) => (
        <div
          key={userId}
          className="remote-cursor"
          style={{
            position: 'absolute',
            top: cursor.position.y,
            left: cursor.position.x
          }}
        />
      ))}
    </div>
  );
}
```

## Event Constants

Copy these constants to your frontend code:

```javascript
// constants/wsEvents.js
export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATED: 'authenticated',
  
  // System
  HEARTBEAT: 'heartbeat',
  PONG: 'pong',
  ERROR: 'error',
  
  // Presence
  ONLINE: 'online',
  OFFLINE: 'offline'
};

export const NOTIFICATION_EVENTS = {
  // Notification delivery
  NOTIFICATION_CREATED: 'notification:created',
  NOTIFICATION_UPDATED: 'notification:updated',
  NOTIFICATION_DELETED: 'notification:deleted',
  
  // Read/Unread
  NOTIFICATION_MARK_READ: 'notification:mark_read',
  NOTIFICATION_MARK_ALL_READ: 'notification:mark_all_read',
  NOTIFICATION_READ_SUCCESS: 'notification:read_success',
  
  // Query
  NOTIFICATION_LIST_REQUEST: 'notification:list_request',
  NOTIFICATION_LIST_RESPONSE: 'notification:list_response',
  NOTIFICATION_COUNT_REQUEST: 'notification:count_request',
  NOTIFICATION_COUNT_RESPONSE: 'notification:count_response'
};

export const COLLAB_EVENTS = {
  // Room management
  JOIN_ENTRY_ROOM: 'join_entry_room',
  LEAVE_ENTRY_ROOM: 'leave_entry_room',
  
  // Editing
  ENTRY_EDIT: 'entry_edit',
  ENTRY_CURSOR_MOVE: 'entry_cursor_move',
  ENTRY_CURSOR_CLEAR: 'entry_cursor_clear',
  
  // Collaboration
  ENTRY_COLLAB_JOIN: 'entry_collab_join',
  ENTRY_COLLAB_LEAVE: 'entry_collab_leave',
  CURRENT_VIEWERS: 'current_viewers',
  
  // State sync
  STATE_REQUEST: 'state_request',
  STATE_RESPONSE: 'state_response',
  DESYNC_DETECTED: 'desync_detected'
};

export const SOCIAL_EVENTS = {
  FRIEND_ONLINE: 'friend_online',
  FRIEND_OFFLINE: 'friend_offline'
};
```

## Error Handling

Implement error handling in your frontend:

```javascript
function ErrorHandler() {
  useEffect(() => {
    wsService.on('error', ({ code, message }) => {
      switch (code) {
        case 'AUTH_ERROR':
          // Redirect to login or refresh token
          console.error('Authentication failed:', message);
          // logout() or refreshToken()
          break;
          
        case 'RATE_LIMIT_EXCEEDED':
          // Show rate limit message to user
          showNotification('You are sending too many requests. Please slow down.');
          break;
          
        case 'ACCESS_DENIED':
          // Show access denied message
          showNotification('You do not have permission for this action.');
          break;
          
        case 'SERVER_ERROR':
          // Show generic error message
          showNotification('An error occurred. Please try again.');
          break;
          
        default:
          console.error(`Unknown error [${code}]:`, message);
      }
    });

    return () => {
      wsService.off('error');
    };
  }, []);

  return null;
}
```

## Connection Status Indicator

```javascript
function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    wsService.on('connect', handleConnect);
    wsService.on('disconnect', handleDisconnect);

    return () => {
      wsService.off('connect', handleConnect);
      wsService.off('disconnect', handleDisconnect);
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="connection-banner offline">
        ⚠️ Disconnected - Attempting to reconnect...
      </div>
    );
  }

  return null;
}
```

## Testing

### Testing WebSocket Connection

```javascript
// test/websocketService.test.js
import wsService from '../services/websocketService';

// Mock token
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Test connection
wsService.connect(mockToken);

// Listen for authentication
wsService.on('authenticated', (data) => {
  console.log('✅ Test: Authenticated', data);
});

// Test emitting event
wsService.emit('notification:count_request');

// Test receiving
wsService.on('notification:count_response', ({ count }) => {
  console.log('✅ Test: Unread count:', count);
});
```

## Production Checklist

- [ ] Replace hardcoded backend URL with environment variable
- [ ] Implement reconnection logic
- [ ] Add error boundaries around WebSocket components
- [ ] Implement loading states
- [ ] Add retry logic for failed events
- [ ] Test with poor network conditions
- [ ] Monitor WebSocket connection metrics
- [ ] Implement fallback for WebSocket failures
- [ ] Add logging/monitoring for production
- [ ] Test with multiple concurrent users

## Environment Variables

Create a `.env` file in your frontend:

```env
REACT_APP_WS_URL=http://your-backend-url:8003
REACT_APP_WS_PATH=/realtime/ws
```

Update your WebSocket service:

```javascript
const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:8003';
const WS_PATH = process.env.REACT_APP_WS_PATH || '/realtime/ws';

this.socket = io(WS_URL, {
  path: WS_PATH,
  // ... other options
});
```

## Required UI Components to Implement

Your frontend should implement these components:

1. **NotificationBell** - Shows unread notifications with dropdown
2. **OnlineStatusIndicator** - Shows online/offline status for users
3. **CollaborationBar** - Shows who is viewing/editing an entry
4. **LiveCursorDisplay** - Renders other users' cursors in editor
5. **ConnectionBanner** - Shows connection status
6. **ErrorToast** - Displays WebSocket errors to users

## Communication Flow Diagram

```
┌──────────────┐
│   Frontend   │
│  Components  │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│ Custom Hooks │
│ (useNotif,   │
│ usePresence, │
│ useCollab)   │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│  WebSocket   │
│   Service    │
│ (socket.io)  │
└──────┬───────┘
       │
       ↓ Socket.IO Protocol
       │
┌──────────────┐
│   Backend    │
│  WS Server   │
│  (Port 8003) │
└──────────────┘
```

## Support & Questions

If you encounter issues:

1. Check the backend logs
2. Verify JWT token is valid
3. Ensure correct backend URL
4. Check network connectivity
5. Verify CORS settings

---

**Integration Version:** 1.0.0  
**Last Updated:** February 2025
