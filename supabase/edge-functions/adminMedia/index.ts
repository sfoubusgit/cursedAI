import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Action =
  | "list"
  | "update"
  | "batch_update";

type ListPayload = {
  action: "list";
  page?: number;
  pageSize?: number;
  status?: string;
  hidden?: boolean;
  search?: string;
};

type UpdatePayload = {
  action: "update";
  media_id: string;
  updates: Record<string, unknown>;
};

type BatchPayload = {
  action: "batch_update";
  media_ids: string[];
  updates: Record<string, unknown>;
};

type Payload = ListPayload | UpdatePayload | BatchPayload;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedUpdates = new Set([
  "is_hidden",
  "status",
  "caption",
  "model_name",
  "prompt",
  "year",
  "ai_generated",
  "origin",
]);

const getToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  return authHeader.replace("Bearer ", "");
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
  const adminEmails = Deno.env.get("ADMIN_EMAILS") ?? "";
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

  const token = getToken(req);
  if (!token) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: userData, error: userError } = await supabase.auth.getUser(
    token
  );
  if (userError || !userData?.user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const userEmail = userData.user.email?.toLowerCase() ?? "";
  const allowedEmailList = adminEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmailList.includes(userEmail)) {
    // ok
  } else {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  }

  if (payload.action === "list") {
    const page = payload.page ?? 0;
    const pageSize = payload.pageSize ?? 20;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("media")
      .select(
        "id, created_at, asset_url, kind, caption, origin, model_name, prompt, year, ai_generated, rating_count, score, confidence, status, is_hidden"
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (payload.status) {
      query = query.eq("status", payload.status);
    }
    if (payload.hidden !== undefined) {
      query = query.eq("is_hidden", payload.hidden);
    }
    if (payload.search) {
      const q = payload.search.replace(/%/g, "");
      query = query.or(
        `caption.ilike.%${q}%,origin.ilike.%${q}%,model_name.ilike.%${q}%,prompt.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
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
    const updates: Record<string, unknown> = {};
    Object.entries(payload.updates ?? {}).forEach(([key, value]) => {
      if (allowedUpdates.has(key)) {
        updates[key] = value;
      }
    });
    if (!payload.media_id || Object.keys(updates).length === 0) {
      return new Response("Missing updates", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase
      .from("media")
      .update(updates)
      .eq("id", payload.media_id)
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

  if (payload.action === "batch_update") {
    if (!payload.media_ids?.length) {
      return new Response("Missing media ids", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const updates: Record<string, unknown> = {};
    Object.entries(payload.updates ?? {}).forEach(([key, value]) => {
      if (allowedUpdates.has(key)) {
        updates[key] = value;
      }
    });

    if (Object.keys(updates).length === 0) {
      return new Response("Missing updates", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase
      .from("media")
      .update(updates)
      .in("id", payload.media_ids)
      .select();

    if (error) {
      return new Response(`Batch update failed: ${error.message}`, {
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
