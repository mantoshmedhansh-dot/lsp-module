-- Phase 2.3: Voice Picking Infrastructure Migration
-- Creates tables for voice-directed picking operations

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Voice Session Status Enum
DO $$ BEGIN
    CREATE TYPE voice_session_status AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'TERMINATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Voice Command Type Enum
DO $$ BEGIN
    CREATE TYPE voice_command_type AS ENUM (
        'CONFIRM', 'SKIP', 'SHORT', 'DAMAGE', 'HELP',
        'REPEAT', 'NEXT', 'BACK', 'LOGOUT', 'QUANTITY', 'LOCATION', 'CHECK_DIGIT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Voice Language Enum
DO $$ BEGIN
    CREATE TYPE voice_language AS ENUM ('en', 'hi', 'ta', 'te', 'kn', 'mr');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ==================== Voice Profile Tables ====================

-- Table: voice_profiles
CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL UNIQUE,
    language VARCHAR(5) DEFAULT 'en',
    "speechRate" DECIMAL(3,2) DEFAULT 1.0,
    volume DECIMAL(3,2) DEFAULT 1.0,
    "pitchOffset" DECIMAL(3,2) DEFAULT 0.0,
    "confirmationRequired" BOOLEAN DEFAULT TRUE,
    "checkDigitLength" INTEGER DEFAULT 2,
    "feedbackEnabled" BOOLEAN DEFAULT TRUE,
    "trainingCompleted" BOOLEAN DEFAULT FALSE,
    "trainingCompletedAt" TIMESTAMP WITH TIME ZONE,
    "customVocabulary" JSONB,
    preferences JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles("userId");


-- ==================== Voice Command Tables ====================

-- Table: voice_commands
CREATE TABLE IF NOT EXISTS voice_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "commandType" VARCHAR(20) NOT NULL,
    language VARCHAR(5) NOT NULL,
    phrase VARCHAR(100) NOT NULL,
    aliases JSONB,
    "responseTemplate" VARCHAR(500) NOT NULL,
    "requiresConfirmation" BOOLEAN DEFAULT FALSE,
    "requiresParameter" BOOLEAN DEFAULT FALSE,
    "parameterType" VARCHAR(20),
    "isActive" BOOLEAN DEFAULT TRUE,
    description VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_commands_type ON voice_commands("commandType");
CREATE INDEX IF NOT EXISTS idx_voice_commands_language ON voice_commands(language);
CREATE INDEX IF NOT EXISTS idx_voice_commands_active ON voice_commands("isActive");


-- ==================== Voice Session Tables ====================

-- Table: voice_sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "warehouseId" UUID NOT NULL,
    "taskId" UUID,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    language VARCHAR(5) DEFAULT 'en',
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "endedAt" TIMESTAMP WITH TIME ZONE,
    "lastActivityAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "currentLineNumber" INTEGER DEFAULT 0,
    "completedLines" INTEGER DEFAULT 0,
    "totalLines" INTEGER DEFAULT 0,
    "pickedUnits" INTEGER DEFAULT 0,
    "skippedLines" INTEGER DEFAULT 0,
    "shortedLines" INTEGER DEFAULT 0,
    "errorCount" INTEGER DEFAULT 0,
    "sessionData" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_voice_sessions_device ON voice_sessions("deviceId");
CREATE INDEX IF NOT EXISTS idx_voice_sessions_warehouse ON voice_sessions("warehouseId");
CREATE INDEX IF NOT EXISTS idx_voice_sessions_task ON voice_sessions("taskId");
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON voice_sessions("startedAt");


-- Table: voice_interactions
CREATE TABLE IF NOT EXISTS voice_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sessionId" UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL,
    "commandType" VARCHAR(20),
    "spokenText" VARCHAR(500),
    "recognizedText" VARCHAR(500),
    confidence DECIMAL(5,4),
    "responseText" VARCHAR(500) NOT NULL,
    "wasSuccessful" BOOLEAN DEFAULT TRUE,
    "errorReason" VARCHAR(255),
    "processingTimeMs" INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_interactions_session ON voice_interactions("sessionId");
CREATE INDEX IF NOT EXISTS idx_voice_interactions_user ON voice_interactions("userId");
CREATE INDEX IF NOT EXISTS idx_voice_interactions_command ON voice_interactions("commandType");
CREATE INDEX IF NOT EXISTS idx_voice_interactions_timestamp ON voice_interactions(timestamp);


-- ==================== Triggers ====================

DROP TRIGGER IF EXISTS update_voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER update_voice_profiles_updated_at
    BEFORE UPDATE ON voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_commands_updated_at ON voice_commands;
CREATE TRIGGER update_voice_commands_updated_at
    BEFORE UPDATE ON voice_commands
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_sessions_updated_at ON voice_sessions;
CREATE TRIGGER update_voice_sessions_updated_at
    BEFORE UPDATE ON voice_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_voice_interactions_updated_at ON voice_interactions;
CREATE TRIGGER update_voice_interactions_updated_at
    BEFORE UPDATE ON voice_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==================== Default Commands ====================

-- Insert default English commands
INSERT INTO voice_commands ("commandType", language, phrase, aliases, "responseTemplate", "requiresConfirmation", description)
VALUES
    ('CONFIRM', 'en', 'confirm', '["yes", "correct", "done", "picked"]', 'Confirmed. {remaining} items remaining.', false, 'Confirm a pick'),
    ('SKIP', 'en', 'skip', '["skip item", "next item", "cant find"]', 'Item skipped. Moving to next.', false, 'Skip current item'),
    ('SHORT', 'en', 'short', '["shortage", "not enough", "partial"]', 'Say the quantity picked.', true, 'Report shortage'),
    ('DAMAGE', 'en', 'damage', '["damaged", "broken"]', 'Damage recorded. Say quantity to pick.', true, 'Report damaged item'),
    ('HELP', 'en', 'help', '["what", "commands"]', 'Say confirm to pick, skip to skip item, or short for shortage.', false, 'Get help'),
    ('REPEAT', 'en', 'repeat', '["say again", "what was that"]', '{last_instruction}', false, 'Repeat last instruction'),
    ('LOGOUT', 'en', 'logout', '["log out", "sign out", "end session"]', 'Session ended. {total} items picked.', false, 'End session')
ON CONFLICT DO NOTHING;


-- ==================== Helper Functions ====================

-- Function to get user voice statistics
CREATE OR REPLACE FUNCTION get_voice_user_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_sessions INTEGER,
    total_picks INTEGER,
    avg_picks_per_hour DECIMAL,
    accuracy_rate DECIMAL,
    avg_session_duration_minutes DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT vs.id)::INTEGER as total_sessions,
        COALESCE(SUM(vs."pickedUnits"), 0)::INTEGER as total_picks,
        CASE
            WHEN SUM(EXTRACT(EPOCH FROM (COALESCE(vs."endedAt", NOW()) - vs."startedAt")) / 3600) > 0
            THEN ROUND(SUM(vs."pickedUnits")::DECIMAL / SUM(EXTRACT(EPOCH FROM (COALESCE(vs."endedAt", NOW()) - vs."startedAt")) / 3600), 2)
            ELSE 0
        END as avg_picks_per_hour,
        CASE
            WHEN SUM(vs."totalLines") > 0
            THEN ROUND(SUM(vs."completedLines")::DECIMAL / SUM(vs."totalLines") * 100, 2)
            ELSE 0
        END as accuracy_rate,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(vs."endedAt", NOW()) - vs."startedAt")) / 60)::DECIMAL, 2) as avg_session_duration_minutes
    FROM voice_sessions vs
    WHERE vs."userId" = p_user_id
    AND vs."startedAt" >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;


COMMENT ON TABLE voice_profiles IS 'User voice settings and preferences';
COMMENT ON TABLE voice_commands IS 'Voice command definitions and translations';
COMMENT ON TABLE voice_sessions IS 'Active and historical voice picking sessions';
COMMENT ON TABLE voice_interactions IS 'Log of voice interactions for analytics';
