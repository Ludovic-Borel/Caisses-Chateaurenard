import { supabase } from "./supabase";

/**
 * Auto-initialize the Supabase database:
 * 1. Sign in with the provided credentials
 * 2. Try to create tables if they don't exist
 */
export async function initializeSupabase(): Promise<boolean> {
  try {
    // Sign in with env credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: "Agent84@villeton.fr",
      password: "Qqqsssddd222+",
    });

    if (signInError) {
      console.warn("Supabase auth sign-in failed:", signInError.message);
      return false;
    }

    // Check if months table exists by querying it
    const { error: monthsCheck } = await supabase
      .from("months")
      .select("id")
      .limit(1);

    if (monthsCheck && monthsCheck.code === "42P01") {
      // Table doesn't exist — try creating it via the auth user's JWT
      console.log("Supabase tables not found, attempting auto-setup...");
      return await createTablesIfNeeded();
    }

    return true;
  } catch (e) {
    console.warn("Supabase initialization failed:", e);
    return false;
  }
}

async function createTablesIfNeeded(): Promise<boolean> {
  try {
    // Use the supabase client to call the Management REST API
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
      ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.months;
    `;

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
      ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.drivers;
    `;

    // Execute SQL via the Management API
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
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;

    const { error } = await supabase.from("months").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}