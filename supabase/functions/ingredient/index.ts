import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id || isNaN(Number(id))) {
    return jsonResponse({ error: "Missing or invalid 'id' parameter." }, 400);
  }

  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "Ingredient not found." }, 404);
  }

  return jsonResponse(data);
});
