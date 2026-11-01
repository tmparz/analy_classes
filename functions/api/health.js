export function onRequestGet({ env }) {
  return new Response(JSON.stringify({
    ok: true,
    service: "analy-classes",
    aiConfigured: !!env.GEMINI_API_KEY,
    turnstileConfigured: !!env.TURNSTILE_SECRET_KEY,
    productionProtection: env.REQUIRE_TURNSTILE === "true"
  }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
