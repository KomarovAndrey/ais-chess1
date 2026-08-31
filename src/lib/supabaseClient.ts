import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Lets Next.js build/prerender when env is missing (CI, fresh clone). */
const BUILD_PLACEHOLDER_URL = "https://placeholder.supabase.co";
const BUILD_PLACEHOLDER_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createBrowserClient(
  supabaseUrl ?? BUILD_PLACEHOLDER_URL,
  supabaseAnonKey ?? BUILD_PLACEHOLDER_KEY
);

if (!supabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "Supabase env vars are not set. Auth and data features will not work until you configure them."
  );
}
