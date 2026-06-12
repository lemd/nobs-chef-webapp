import { createClient } from "npm:@supabase/supabase-js";

export type AuthUser = {
  id: string;
  email?: string;
};

/**
 * Extracts and verifies the Bearer JWT from the request.
 * Returns the Supabase user, or null if missing/invalid.
 */
export async function getUserFromRequest(
  req: Request
): Promise<AuthUser | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const jwt = auth.slice(7);

  // Use anon key + user JWT — Supabase verifies the token server-side
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt);

  if (error || !user) return null;
  return { id: user.id, email: user.email };
}
