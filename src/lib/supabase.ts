import { createClient } from "@supabase/supabase-js";

export let supabase: ReturnType<typeof createClient> | null = null;

export function configureSupabase(url: string, key: string) {
  try {
    supabase = createClient(url, key);
  } catch (e) {
    supabase = null;
    console.warn("Failed to configure Supabase client:", e);
  }
}

// Try to auto-configure from env or localStorage if available
try {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (envUrl && envKey) {
    configureSupabase(envUrl, envKey);
  } else if (typeof localStorage !== "undefined") {
    const storedUrl = localStorage.getItem("SUPABASE_URL");
    const storedKey = localStorage.getItem("SUPABASE_KEY");
    if (storedUrl && storedKey) configureSupabase(storedUrl, storedKey);
  }
} catch (e) {
  // ignore (SSR or environments without localStorage)
}

export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

// ---------- Auth helpers (guarded) ----------
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  if (!supabase) throw new Error("Supabase not configured");
  const { data } = await supabase.auth.getSession();
  return data.session;
}