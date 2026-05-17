-- ============================================
-- Supabase Schema for Recettes Lignes Mensuelles
-- Execute this in the Supabase SQL Editor
-- ============================================

-- 1. month_data table: stores month data by year/month
CREATE TABLE IF NOT EXISTS public.month_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_month_data_year_month ON public.month_data(year, month);

-- 2. Drivers table: stores the list of driver names (one row per driver)
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_name ON public.drivers(name);

-- 3. Enable Row Level Security (but allow public access for this app)
ALTER TABLE public.month_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Allow public access (authenticated or not) - single user app
DROP POLICY IF EXISTS "Public access" ON public.month_data;
CREATE POLICY "Public access" ON public.month_data
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access" ON public.drivers;
CREATE POLICY "Public access" ON public.drivers
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.month_data;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.drivers;

-- 5. Function to update updated_at automatically
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_month_data_updated_at ON public.month_data;
CREATE TRIGGER trg_month_data_updated_at
  BEFORE UPDATE ON public.month_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();