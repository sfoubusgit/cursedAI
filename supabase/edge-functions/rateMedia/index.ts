import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type RatePayload = {
  session_id: string;
  media_id: string;
  rating: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    return new Response("Missing Supabase environment", { status: 500 });
  }

  let payload: RatePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { session_id, media_id, rating } = payload;
  if (!session_id || !media_id || !Number.isInteger(rating)) {
    return new Response("Missing or invalid fields", {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (rating < 1 || rating > 100) {
    return new Response("Rating out of range", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error: insertError } = await supabase.from("ratings").insert({
    session_id,
    media_id,
    rating,
  });

  if (insertError) {
    if (insertError.code === "23505") {
    return new Response("Duplicate rating", {
      status: 409,
      headers: corsHeaders,
    });
    }
    return new Response(`Rating insert failed: ${insertError.message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select(
      "id, rating_count, rating_sum, rating_sum_sq, score, confidence, status"
    )
    .eq("id", media_id)
    .single();

  if (mediaError || !media) {
    return new Response("Media not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const currentCount = media.rating_count ?? 0;
  const currentSum = media.rating_sum ?? 0;
  const currentSumSq = media.rating_sum_sq ?? 0;

  const nextCount = currentCount + 1;
  const nextSum = currentSum + rating;
  const nextSumSq = currentSumSq + rating * rating;

  const mu0 = 50;
  const k = 12;
  const bayes = (mu0 * k + nextSum) / (k + nextCount);
  const confidence = 1 - Math.exp(-nextCount / 12);
  const mean = nextSum / nextCount;
  const variance = Math.max(0, nextSumSq / nextCount - mean * mean);
  const std = Math.sqrt(variance);
  const normalized = clamp(std / 40, 0, 1);
  const penalty = normalized * 8;
  const score = clamp(bayes - penalty, 0, 100);

  let nextStatus = media.status ?? "active";
  if (nextStatus !== "removed" && confidence >= 0.8 && score <= 18) {
    nextStatus = "graveyard";
  }

  const { error: updateError } = await supabase
    .from("media")
    .update({
      rating_count: nextCount,
      rating_sum: nextSum,
      rating_sum_sq: nextSumSq,
      score,
      confidence,
      status: nextStatus,
    })
    .eq("id", media_id);

  if (updateError) {
    return new Response(`Media update failed: ${updateError.message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      score,
      confidence,
      status: nextStatus,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    }
  );
});
