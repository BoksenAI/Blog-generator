
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL ERROR: Missing Supabase environment variables in client/.env");
    console.error("Please ensure you have VITE_SUPABASE_URL and VITE_SUPABASE_KEY defined.");
}

export const supabase = createClient(
    supabaseUrl || "https://placeholder-url.supabase.co",
    supabaseKey || "placeholder-key"
);
