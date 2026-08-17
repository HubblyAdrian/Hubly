// hire-crm — service-role CRM upsert after owner accept (or staff repair).
// Public booking must not write customers. Owner JWT required; write uses service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertCrmFromBooking } from "../_shared/crm_from_booking.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonRes({ error: "Sign in required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonRes({ error: "Server isn’t configured yet." }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.business_id || "").trim();
    if (!businessId) return jsonRes({ error: "business_id required" }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Your session expired — refresh and try again." }, 401);
    }

    const { data: owned } = await userClient
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("owner_id", userData.user.id)
      .maybeSingle();
    if (!owned) return jsonRes({ error: "Business not found for this account" }, 403);

    const admin = createClient(supabaseUrl, serviceKey);
    const result = await upsertCrmFromBooking(admin, {
      business_id: businessId,
      customer_name: body?.customer_name ?? body?.name,
      customer_phone: body?.customer_phone ?? body?.phone,
      customer_email: body?.customer_email ?? body?.email,
      service_name: body?.service_name ?? body?.preferred_service,
      vehicle_type: body?.vehicle_type ?? body?.vehicleType,
      vehicle_year: body?.vehicle_year ?? body?.vehicleYear,
      vehicle_make: body?.vehicle_make ?? body?.vehicleMake,
      vehicle_model: body?.vehicle_model ?? body?.vehicleModel,
      vehicle_color: body?.vehicle_color ?? body?.vehicleColor,
      vehicle: body?.vehicle,
      notes: body?.notes,
      customer_type: body?.customer_type ?? body?.customerType,
    });

    if (!result.ok) return jsonRes({ error: result.error || "CRM upsert failed" }, 400);
    return jsonRes({ ok: true, customer_id: result.customer_id });
  } catch (e) {
    console.error("hire-crm", e);
    return jsonRes({ error: e instanceof Error ? e.message : "CRM upsert failed" }, 500);
  }
});
