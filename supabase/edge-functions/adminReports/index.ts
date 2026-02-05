import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Action = "list" | "resolve";

type ListPayload = {
  action: "list";
  page?: number;
  pageSize?: number;
  status?: string;
};

type ResolvePayload = {
  action: "resolve";
  report_id: string;
  resolution_note?: string;
  media_update?: {
    media_id: string;
    updates: Record<string, unknown>;
  };
};

type Payload = ListPayload | ResolvePayload;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedMediaUpdates = new Set(["is_hidden", "status"]);

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
    const page = payload.page ?? 0;
    const pageSize = payload.pageSize ?? 20;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("reports")
      .select(
        "id, created_at, reason, details, media_asset_url, media_kind, media_caption, status, resolved_at, resolved_by, resolution_note, media:media_id (id, asset_url, kind, caption, origin, status, is_hidden)"
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (payload.status) {
      query = query.eq("status", payload.status);
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

  if (payload.action === "resolve") {
    if (!payload.report_id) {
      return new Response("Missing report id", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const updates = {
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: adminCheck.userId,
      resolution_note: payload.resolution_note ?? null,
    };

    const { data: reportData, error: reportError } = await supabase
      .from("reports")
      .update(updates)
      .eq("id", payload.report_id)
      .select()
      .single();

    if (reportError) {
      return new Response(`Resolve failed: ${reportError.message}`, {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (payload.media_update?.media_id) {
      const mediaUpdates: Record<string, unknown> = {};
      Object.entries(payload.media_update.updates ?? {}).forEach(([key, value]) => {
        if (allowedMediaUpdates.has(key)) {
          mediaUpdates[key] = value;
        }
      });

      if (Object.keys(mediaUpdates).length) {
        const { error: mediaError } = await supabase
          .from("media")
          .update(mediaUpdates)
          .eq("id", payload.media_update.media_id);
        if (mediaError) {
          return new Response(`Media update failed: ${mediaError.message}`, {
            status: 400,
            headers: corsHeaders,
          });
        }
      }
    }

    return new Response(JSON.stringify({ data: reportData }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response("Invalid action", { status: 400, headers: corsHeaders });
});
