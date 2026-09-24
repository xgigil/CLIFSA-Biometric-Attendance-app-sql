import { cookies } from "next/headers";
import { createDbClient } from "@/lib/db-client";

export const createClient = async () => {
  const cookieStore = await cookies();
  return createDbClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Server Components cannot always write cookies.
      }
    },
  });
};

export const createAdminClient = async () => {
  return createDbClient({
    getAll() {
      return [];
    },
  });
};
