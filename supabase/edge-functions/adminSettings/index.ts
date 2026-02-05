import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Action = "list" | "update";

type ListPayload = {
  action: "list";
};

type UpdatePayload = {
  action: "update";
  key: string;
  value: unknown;
};

type Payload = ListPayload | UpdatePayload;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const getToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  return authHeader.replace("Bearer ", "");
};

const assertAdmin = async (supabase: ReturnType<typeof createClient>, req: Request) => {
  const token = getToken(req);
  if (!token) {
    return { ok: false, response: new Response("Unauthorized", { status: 401, headers: corsHeaders }) };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { ok: false, response: new Response("Unauthorized", { status: 401, headers: corsHeaders }) };
  }
  const adminEmails = Deno.env.get("ADMIN_EMAILS") ?? "";
  const userEmail = userData.user.email?.toLowerCase() ?? "";
  const allowedEmailList = adminEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmailList.includes(userEmail)) {
    return { ok: true, userId: userData.user.id };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!adminRow) {
    return { ok: false, response: new Response("Forbidden", { status: 403, headers: corsHeaders }) };
  }
  return { ok: true, userId: userData.user.id };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return new Response("Missing Supabase environment", {
      status: 500,
      headers: corsHeaders,
    });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adminCheck = await assertAdmin(supabase, req);
  if (!adminCheck.ok) {
    return adminCheck.response!;
  }

  if (payload.action === "list") {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value, updated_at, updated_by")
      .order("key");
    if (error) {
      return new Response(`Query failed: ${error.message}`, {
        status: 400,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (payload.action === "update") {
    if (!payload.key) {
      return new Response("Missing key", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase
      .from("app_settings")
      .upsert({
        key: payload.key,
        value: payload.value ?? {},
        updated_by: adminCheck.userId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return new Response(`Update failed: ${error.message}`, {
        status: 400,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response("Invalid action", { status: 400, headers: corsHeaders });
});
