import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let supabase: SupabaseClient<Database> | null = null;

// Prevent the app from crashing entirely if the Supabase URL is missing on deployment
if (SUPABASE_URL && SUPABASE_URL !== "undefined") {
  try {
    supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY || "", {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  } catch (error) {
    console.warn("[Supabase] Failed to initialize:", error);
  }
} else {
  console.warn("[Supabase] Missing URL. Set VITE_SUPABASE_URL in your environment variables.");
}

export { supabase };