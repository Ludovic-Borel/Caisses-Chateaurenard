import { supabase, configureSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Auto-initialize the Supabase database.
 * 
 * NOTE: Les tables Supabase ont une politique RLS publique,
 * donc l'authentification n'est pas nécessaire pour lire/écrire.
 * 
 * Cette fonction vérifie simplement que les tables existent.
 * Si elles n'existent pas, elle essaie de les créer via l'API Management
 * (ce qui nécessite une session auth valide - si ça échoue, on continue
 *  sans, et l'utilisateur devra exécuter le SQL manuellement).
 */
export async function initializeSupabase(): Promise<boolean> {
  try {
    // If supabase client isn't configured yet, try to read runtime config from localStorage
    try {
      if (!isSupabaseConfigured() && typeof localStorage !== "undefined") {
        const url = localStorage.getItem("SUPABASE_URL");
        const key = localStorage.getItem("SUPABASE_KEY");
        if (url && key) configureSupabase(url, key);
      }
    } catch {}

    if (!isSupabaseConfigured()) {
      console.warn("Supabase client not configured - skipping remote initialization");
      return false;
    }

    // Tentative de connexion via variables d'environnement
    const envEmail = import.meta.env.VITE_SUPABASE_EMAIL;
    const envPassword = import.meta.env.VITE_SUPABASE_PASSWORD;
    if (envEmail && envPassword) {
      const { error: signInError } = await supabase!.auth.signInWithPassword({
        email: envEmail,
        password: envPassword,
      });
      if (signInError) {
        console.warn("Supabase auth sign-in failed (non bloquant):", signInError.message);
      }
    }

    // Vérifier si la table months existe
    const { error: monthsCheck } = await supabase
      .from("months")
      .select("id")
      .limit(1);

    if (!monthsCheck) {
      // Table existe = Supabase opérationnel
      return true;
    }

    if (monthsCheck.code === "42P01") {
      // Table doesn't exist — try creating it via the auth user's JWT
      console.log("Supabase tables not found, attempting auto-setup...");
      const created = await createTablesIfNeeded();
      if (created) return true;
      
      // Même si la création automatique échoue, on retourne true
      // car l'app peut fonctionner localement et l'utilisateur
      // peut exécuter le SQL manuellement.
      console.warn(
        "Auto-setup failed. Execute supabase-schema.sql in Supabase SQL Editor."
      );
      return false;
    }

    // Autre erreur (ex: table existe mais problème de permissions)
    console.warn("Supabase months table check failed:", monthsCheck.message);
    return false;
  } catch (e) {
    console.warn("Supabase initialization failed:", e);
    return false;
  }
}

async function createTablesIfNeeded(): Promise<boolean> {
  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      console.warn("No access token available for table creation");
      return false;
    }

    const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;

    // Create months table
    const sqlCreateMonths = `
      CREATE TABLE IF NOT EXISTS public.months (
        id BIGSERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(year, month)
      );
      CREATE INDEX IF NOT EXISTS idx_months_year_month ON public.months(year, month);
      ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public access" ON public.months;
      CREATE POLICY "Public access" ON public.months FOR ALL USING (true) WITH CHECK (true);
      DO $$
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.months;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      $$;
    `;

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: sqlCreateMonths }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.warn("Failed to create months table:", response.status, errBody);
      return false;
    }

    // Create drivers table
    const sqlCreateDrivers = `
      CREATE TABLE IF NOT EXISTS public.drivers (
        id BIGSERIAL PRIMARY KEY,
        names JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO public.drivers (id, names) VALUES (1, '[]'::jsonb) ON CONFLICT (id) DO NOTHING;
      ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Public access" ON public.drivers;
      CREATE POLICY "Public access" ON public.drivers FOR ALL USING (true) WITH CHECK (true);
      DO $$
      BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      $$;
    `;

    const response2 = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/sql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: sqlCreateDrivers }),
      }
    );

    if (!response2.ok) {
      const errBody = await response2.text();
      console.warn("Failed to create drivers table:", response2.status, errBody);
      return false;
    }

    const trgMonths = `
      CREATE OR REPLACE FUNCTION public.update_updated_at()
      RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_months_updated_at ON public.months;
      CREATE TRIGGER trg_months_updated_at BEFORE UPDATE ON public.months FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
      DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
      CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    `;

    await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: trgMonths }),
    });

    console.log("Supabase tables created successfully");
    return true;
  } catch (e) {
    console.warn("Auto-setup failed:", e);
    return false;
  }
}

/**
 * Check if Supabase is available/configured
 */
export async function isSupabaseAvailable(): Promise<boolean> {
  try {
    const { error } = await supabase.from("months").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}