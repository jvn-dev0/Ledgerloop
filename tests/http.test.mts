import assert from "node:assert/strict";
import test from "node:test";
import { readRequestBodyWithinLimit } from "../lib/http/request-body.js";

test("bounded request reader keeps an in-limit body intact", async () => {
  const request = new Request("https://ledgerloop.test/api", {
    method: "POST",
    body: "{\"message\":\"hello\"}",
  });

  const result = await readRequestBodyWithinLimit(request, 64);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(new TextDecoder().decode(result.bytes), "{\"message\":\"hello\"}");
});

test("bounded request reader rejects an oversized declared body", async () => {
  const request = new Request("https://ledgerloop.test/api", {
    method: "POST",
    headers: { "content-length": "100" },
    body: "small",
  });

  assert.deepEqual(await readRequestBodyWithinLimit(request, 10), { ok: false, reason: "too_large" });
});

test("bounded request reader caps a streamed body even without a length header", async () => {
  const request = new Request("https://ledgerloop.test/api", {
    method: "POST",
    body: "this body exceeds the limit",
  });

  assert.deepEqual(await readRequestBodyWithinLimit(request, 5), { ok: false, reason: "too_large" });
});
