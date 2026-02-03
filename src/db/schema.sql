-- ============================================
-- Quick Fix: Create Missing Tables
-- Run this in your PostgreSQL database
-- ============================================

-- First, connect to the diary database
-- \c diary;

-- Drop existing tables if they have issues (CAREFUL!)
-- DROP TABLE IF EXISTS active_sessions CASCADE;
-- DROP TABLE IF EXISTS ws_connections CASCADE;

-- ============================================
-- Create ws_connections table
-- ============================================
CREATE TABLE IF NOT EXISTS ws_connections (
    user_id VARCHAR(255) PRIMARY KEY,
    socket_id VARCHAR(255),
    online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Create active_sessions table
-- ============================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    entry_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(10) DEFAULT 'viewing',
    joined_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_entry_user UNIQUE(entry_id, user_id)
);

-- ============================================
-- Create friends table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    friend_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_friendship UNIQUE(user_id, friend_id)
);

-- ============================================
-- Create diary_entries table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS diary_entries (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Create Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ws_connections_online 
    ON ws_connections(online);

CREATE INDEX IF NOT EXISTS idx_ws_connections_user_id 
    ON ws_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_entry_id 
    ON active_sessions(entry_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id 
    ON active_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_active_sessions_last_seen 
    ON active_sessions(last_seen);

CREATE INDEX IF NOT EXISTS idx_friends_user_id 
    ON friends(user_id);

CREATE INDEX IF NOT EXISTS idx_friends_friend_id 
    ON friends(friend_id);

-- ============================================
-- Insert Sample Data for Testing
-- ============================================
INSERT INTO friends (user_id, friend_id) VALUES 
    ('user_1', 'user_2'),
    ('user_2', 'user_1'),
    ('user_1', 'user_3'),
    ('user_3', 'user_1')
ON CONFLICT (user_id, friend_id) DO NOTHING;

INSERT INTO diary_entries (id, user_id, content) VALUES 
    ('entry_123', 'user_1', 'This is my first diary entry!'),
    ('entry_456', 'user_2', 'Second entry for testing')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 'Tables created successfully!' as status;

-- Show all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;