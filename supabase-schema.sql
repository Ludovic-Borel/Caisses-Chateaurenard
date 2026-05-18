-- ============================================
-- Schéma correct pour Recettes Lignes Mensuelles
-- À exécuter dans le SQL Editor de Supabase
-- ============================================
-- ATTENTION : Ce script supprime les anciennes tables
-- month_data et drivers (structure incorrecte) et
-- les recrée avec la structure attendue par l'app.
-- ============================================

-- 1. Supprimer les anciennes tables si elles existent (mauvaise structure)
DROP TABLE IF EXISTS public.month_data CASCADE;

-- 2. Table months : stocke les données d'un mois (year, month, data JSONB)
--    C'est la table utilisée par storage.ts (loadMonth, saveMonth, loadAllMonths)
CREATE TABLE IF NOT EXISTS public.months (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_months_year_month ON public.months(year, month);

-- 3. Table drivers : stocke la liste des chauffeurs dans une seule ligne
--    avec names JSONB contenant un tableau de noms.
--    Utilisée par storage.ts (loadDrivers, saveDrivers) avec id=1
TRUNCATE TABLE public.drivers;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS names JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- S'assurer que la ligne id=1 existe
INSERT INTO public.drivers (id, names) VALUES (1, '[]'::jsonb) ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (accès public pour cette app mono-utilisateur)
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON public.months;
CREATE POLICY "Public access" ON public.months
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access" ON public.drivers;
CREATE POLICY "Public access" ON public.drivers
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable realtime replication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.months;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- 6. Trigger function pour updated_at automatique
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