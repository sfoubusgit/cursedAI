import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    return { ok: true };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!adminRow) {
    return { ok: false, response: new Response("Forbidden", { status: 403, headers: corsHeaders }) };
  }
  return { ok: true };
};

const fileExtension = (url: string, kind: string) => {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").pop() ?? "";
    if (name.includes(".")) {
      return name.split(".").pop() ?? "bin";
    }
  } catch {
    // ignore
  }
  return kind === "video" ? "mp4" : "jpg";
};

serve(async (req) => {
  try {
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

  let payload: { from?: string; to?: string; all_time?: boolean; limit?: number; page?: number };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const allTime = payload.all_time === true;
  const limit = Math.min(25, Math.max(1, Number(payload.limit ?? 25)));
  const page = Math.max(1, Number(payload.page ?? 1));
  const fromIndex = (page - 1) * limit;
  const toIndex = fromIndex + limit - 1;
  if (!allTime && (!payload.from || !payload.to)) {
    return new Response("Missing date range", { status: 400, headers: corsHeaders });
  }

  const fromDate = allTime ? null : new Date(`${payload.from}T00:00:00.000Z`);
  const toDate = allTime ? null : new Date(`${payload.to}T23:59:59.999Z`);
  if (!allTime && (Number.isNaN(fromDate!.getTime()) || Number.isNaN(toDate!.getTime()))) {
    return new Response("Invalid date range", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adminCheck = await assertAdmin(supabase, req);
  if (!adminCheck.ok) {
    return adminCheck.response!;
  }

  let query = supabase
    .from("media")
    .select("id, created_at, asset_url, kind, caption, origin, model_name, prompt, year, ai_generated, rating_count, rating_sum, rating_sum_sq, score, confidence, status, is_hidden")
    .order("created_at", { ascending: true });

  if (!allTime && fromDate && toDate) {
    query = query
      .gte("created_at", fromDate.toISOString())
      .lte("created_at", toDate.toISOString());
  }

  const { data: mediaRows, error } = await query.range(fromIndex, toIndex);

  if (error) {
    return new Response(`Query failed: ${error.message}`, { status: 400, headers: corsHeaders });
  }

  const metadata = (mediaRows ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    asset_url: row.asset_url,
    kind: row.kind,
    caption: row.caption,
    origin: row.origin,
    model_name: row.model_name,
    prompt: row.prompt,
    year: row.year,
    ai_generated: row.ai_generated,
    rating_count: row.rating_count,
    rating_sum: row.rating_sum,
    rating_sum_sq: row.rating_sum_sq,
    score: row.score,
    confidence: row.confidence,
    status: row.status,
    is_hidden: row.is_hidden,
  }));

  const JSZipModule = await import("https://esm.sh/jszip@3.10.1");
  const JSZip = JSZipModule.default;
  const zip = new JSZip();
  const encoder = new TextEncoder();

  zip.file("metadata.json", encoder.encode(JSON.stringify(metadata, null, 2)));

  for (const row of mediaRows ?? []) {
    try {
      const response = await fetch(row.asset_url);
      if (!response.ok) continue;
      const arrayBuffer = await response.arrayBuffer();
      const ext = fileExtension(row.asset_url, row.kind);
      const filename = `media/${row.created_at.slice(0, 10)}-${row.id}.${ext}`;
      zip.file(filename, new Uint8Array(arrayBuffer));
    } catch {
      // ignore single failures
    }
  }

  const zipData = await zip.generateAsync({ type: "uint8array" });

  return new Response(zipData, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": allTime
        ? `attachment; filename=\"cursedai-export-all-time-page-${page}-limit-${limit}.zip\"`
        : `attachment; filename=\"cursedai-export-${payload.from}-to-${payload.to}-page-${page}-limit-${limit}.zip\"`,
      ...corsHeaders,
    },
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    console.error("adminExport error:", error);
    return new Response(`Export failed: ${message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
