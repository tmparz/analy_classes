import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequestGet } from "../functions/api/analyze.js";

const answers = { industry: "美容／美體", pain: "預約排程", tools: ["LINE"], frequency: 35, minutes: 10, goal: "節省時間", notes: "" };
const env = { GEMINI_API_KEY: "test-key" };
const post = (body, headers = {}) => new Request("https://example.test/api/analyze", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body)
});
const aiReport = { title: "T", summary: "S", risks: ["A", "B"], opportunities: [0, 1, 2].map(i => ({ title: "O" + i, why: "W", how: "H", effort: "低" })), nextSteps: ["1", "2", "3"], flow: ["a", "b", "c", "d"] };

function mockFetch(t, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => { globalThis.fetch = original; });
}

test("returns 503 without an API key", async () => {
  const res = await onRequestPost({ request: post({ answers }), env: {} });
  assert.equal(res.status, 503);
});
test("rejects cross-origin requests", async () => {
  const res = await onRequestPost({ request: post({ answers }, { origin: "https://evil.test" }), env });
  assert.equal(res.status, 403);
});
test("a JSON null body is a clean 400, not an internal error message", async () => {
  const res = await onRequestPost({ request: post("null"), env });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "送出資料格式錯誤。");
});
test("oversized bodies are rejected by byte size", async () => {
  const res = await onRequestPost({ request: post({ answers: { ...answers, notes: "字".repeat(3000) } }), env });
  assert.equal(res.status, 413);
});
test("requires a Turnstile token when a secret is configured", async t => {
  mockFetch(t, async () => { throw new Error("should not call out without a token"); });
  const res = await onRequestPost({ request: post({ answers }), env: { ...env, TURNSTILE_SECRET_KEY: "s" } });
  assert.equal(res.status, 403);
});
test("returns a normalized AI report on success", async t => {
  mockFetch(t, async url => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(aiReport) }] } }] });
  });
  const res = await onRequestPost({ request: post({ answers }), env });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.report.isDemo, false);
  assert.equal(data.metrics.weeklyMinutes, 350);
});
test("maps upstream 429 to a friendly 502", async t => {
  mockFetch(t, async () => new Response("{}", { status: 429 }));
  const res = await onRequestPost({ request: post({ answers }), env });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /使用量較高/);
});
test("GET returns 405 with an Allow header", async () => {
  const res = onRequestGet();
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "POST");
});
