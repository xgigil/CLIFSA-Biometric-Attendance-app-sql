// import { createBrowserClient } from "@supabase/ssr";

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// export const createClient = () =>
//   createBrowserClient(supabaseUrl!, supabaseKey!);

export function createClient(): never {
  throw new Error("Browser cannot talk to MySQL directly. Use a server action instead.");
}
