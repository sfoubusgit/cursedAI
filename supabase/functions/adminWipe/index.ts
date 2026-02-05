import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type Action = "media_only" | "media_and_ratings";

type Payload = {
  action: Action;
};

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

const assertAdmin = async (
  supabase: ReturnType<typeof createClient>,
  req: Request
) => {
  const token = getToken(req);
  if (!token) {
    return {
      ok: false,
      response: new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      }),
    };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false,
      response: new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      }),
    };
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
    return {
      ok: false,
      response: new Response("Forbidden", {
        status: 403,
        headers: corsHeaders,
      }),
    };
  }
  return { ok: true };
};

const deleteStorageObjects = async (supabase: ReturnType<typeof createClient>) => {
  const bucket = supabase.storage.from("media");
  const folders = ["uploads"];

  for (const root of folders) {
    const { data: roots } = await bucket.list(root, { limit: 200 });
    if (!roots) continue;
    for (const entry of roots) {
      const folderPath = `${root}/${entry.name}`;
      const { data: objects } = await bucket.list(folderPath, { limit: 200 });
      if (!objects) continue;
      const files = objects
        .filter((obj) => obj.id)
        .map((obj) => `${folderPath}/${obj.name}`);
      if (files.length) {
        await bucket.remove(files);
      }
    }
  }
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

  if (!payload.action) {
    return new Response("Missing action", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const adminCheck = await assertAdmin(supabase, req);
  if (!adminCheck.ok) {
    return adminCheck.response!;
  }

  if (payload.action === "media_and_ratings") {
    const { error: reportsError } = await supabase.from("reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (reportsError) {
      return new Response(`Delete failed: ${reportsError.message}`, {
        status: 400,
        headers: corsHeaders,
      });
    }
    const { error: ratingsError } = await supabase.from("ratings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (ratingsError) {
      return new Response(`Delete failed: ${ratingsError.message}`, {
        status: 400,
        headers: corsHeaders,
      });
    }
  }

  const { error: mediaError } = await supabase.from("media").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (mediaError) {
    return new Response(`Delete failed: ${mediaError.message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  await deleteStorageObjects(supabase);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
