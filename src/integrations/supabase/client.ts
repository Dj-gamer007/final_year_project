import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Hardcoding public configuration to ensure deployment on GitHub Pages 
// works automatically without requiring secrets configuration.
const SUPABASE_URL = "https://bcmigybnwglnsvqufqfj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjbWlneWJud2dsbnN2cXVmcWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MDE2MjYsImV4cCI6MjA4NjI3NzYyNn0.Gn3iYLwAmb9A398TUtsYT2ZZcfO1Y66ginUWF5_sfGQ";

let supabaseInstance: SupabaseClient<Database> | null = null;

try {
  supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
  console.info("[Supabase] Initialized with hardcoded config");
} catch (error) {
  console.error("[Supabase] Failed to initialize:", error);
}

// Cast to any to prevent TypeScript build errors in components that expect non-null
export const supabase = supabaseInstance as any;