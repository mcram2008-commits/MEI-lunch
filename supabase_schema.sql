-- Create Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    "profileImg" TEXT,
    "rollNo" TEXT,
    department TEXT,
    year TEXT,
    section TEXT,
    "parentPhone" TEXT,
    "studentPhone" TEXT,
    "assignedClass" TEXT,
    phone TEXT,
    "appliedAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create Passes table
CREATE TABLE IF NOT EXISTS passes (
    id TEXT PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    "appliedAt" TEXT NOT NULL,
    date TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    reason TEXT,
    "approvedAt" TEXT,
    "scannedOutAt" TEXT,
    "scannedInAt" TEXT,
    "studentNotified" BOOLEAN DEFAULT FALSE,
    "advisorNotified" BOOLEAN DEFAULT FALSE,
    "parentNotified" BOOLEAN DEFAULT FALSE,
    lat FLOAT,
    lng FLOAT,
    "verifiedReturn" BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access (since we are doing client-side sync)
CREATE POLICY "Public Access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access" ON passes FOR ALL USING (true) WITH CHECK (true);

