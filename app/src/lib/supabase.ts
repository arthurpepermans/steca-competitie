import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configOk = Boolean(url && key);

export const supabase: SupabaseClient = createClient(
  url ?? "https://ontbreekt.supabase.co",
  key ?? "ontbreekt",
);
