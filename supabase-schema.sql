-- ============================================
-- Supabase Schema for Recettes Lignes Mensuelles
-- Execute this in the Supabase SQL Editor
-- ============================================

-- 1. Months table: stores month data by year/month
CREATE TABLE IF NOT EXISTS public.months (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 0-11
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_months_year_month ON public.months(year, month);

-- 2. Drivers table: stores the list of driver names
CREATE TABLE IF NOT EXISTS public.drivers (
  id BIGSERIAL PRIMARY KEY,
  names JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default drivers row (singleton)
INSERT INTO public.drivers (id, names)
VALUES (1, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security (but allow public access for this app)
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Allow public access (authenticated or not) - single user app
DROP POLICY IF EXISTS "Public access" ON public.months;
CREATE POLICY "Public access" ON public.months
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access" ON public.drivers;
CREATE POLICY "Public access" ON public.drivers
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable realtime replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.months;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;

-- 5. Function to update updated_at automatically
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_months_updated_at ON public.months;
CREATE TRIGGER trg_months_updated_at
  BEFORE UPDATE ON public.months
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
CREATE TRIGGER trg_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();