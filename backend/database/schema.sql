-- =========================================
-- TEMPLE AI OPERATIONS MANAGEMENT SYSTEM
-- COMPLETE DATABASE
-- =========================================

-- 1. USERS
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (
        role IN ('chairman', 'committee', 'staff', 'volunteer')
    ),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. STAFF PROFILES
CREATE TABLE staff_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id)
        ON DELETE CASCADE,
    job_title VARCHAR(100),
    phone VARCHAR(20),
    availability VARCHAR(20) DEFAULT 'available'
);

-- 3. TASKS
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    task_type VARCHAR(30) DEFAULT 'daily',
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'assigned'
        CHECK (status IN (
            'assigned', 'completed',
            'pending_verification', 'approved', 'closed'
        )),
    requires_verification BOOLEAN DEFAULT FALSE,
    due_at TIMESTAMP,
    completed_at TIMESTAMP,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ATTENDANCE
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present'
        CHECK (status IN ('present', 'absent', 'late')),
    marked_by INTEGER REFERENCES users(id),
    notes TEXT,
    UNIQUE (user_id, attendance_date)
);

-- 5. BOOKINGS
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    booking_type VARCHAR(20) NOT NULL
        CHECK (booking_type IN ('hall', 'room', 'event')),
    resource_name VARCHAR(150) NOT NULL,
    event_title VARCHAR(200) NOT NULL,
    booked_by INTEGER REFERENCES users(id),
    start_at TIMESTAMP NOT NULL,
    end_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN (
            'pending', 'approved', 'rejected', 'cancelled'
        )),
    approved_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_at > start_at)
);

-- 6. NOTIFICATIONS
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. TASK COMMENTS
CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. AUDIT LOGS
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. AI CONVERSATIONS
CREATE TABLE ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. AI MESSAGES
CREATE TABLE ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES ai_conversations(id)
        ON DELETE CASCADE,
    sender VARCHAR(20) NOT NULL
        CHECK (sender IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. AI KNOWLEDGE BASE
CREATE TABLE ai_knowledge_base (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PERFORMANCE INDEXES
CREATE INDEX idx_tasks_assigned_to
ON tasks(assigned_to);

CREATE INDEX idx_tasks_status
ON tasks(status);

CREATE INDEX idx_attendance_date
ON attendance(attendance_date);

CREATE INDEX idx_bookings_start_at
ON bookings(start_at);

CREATE INDEX idx_notifications_user
ON notifications(user_id);

CREATE INDEX idx_ai_conversations_user
ON ai_conversations(user_id);

CREATE INDEX idx_ai_messages_conversation
ON ai_messages(conversation_id);

-- =========================================
-- DATABASE CREATION COMPLETED
-- =========================================