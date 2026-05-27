-- Migration: Create change_logs table for tracking modifications
CREATE TABLE IF NOT EXISTS change_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL DEFAULT 'inconnu',
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  driver TEXT,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast filtering by month
CREATE INDEX IF NOT EXISTS idx_change_logs_month ON change_logs (year, month);

-- Enable RLS (optional but safe)
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (matching app's existing pattern)
CREATE POLICY "Allow anonymous insert" ON change_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous select" ON change_logs FOR SELECT TO anon USING (true);