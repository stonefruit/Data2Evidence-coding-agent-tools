import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeMriQuery, encodeMriQuery } from "../src/codec.js";

test("round-trips JSON through URL-safe compressed payloads", () => {
  const query = {
    filter: { cards: { content: [], op: "AND" } },
    chartType: "stacked",
    metadata: { version: 3 },
  };

  const encoded = encodeMriQuery(query);

  assert.equal(encoded.includes("+"), false);
  assert.equal(encoded.includes("/"), false);
  assert.equal(encoded.includes("="), false);
  assert.deepEqual(decodeMriQuery(encoded), query);
});

test("decodes percent-encoded standard base64 payloads", () => {
  const query = { filter: { op: "OR" }, metadata: { version: 1 } };
  const encoded = encodeURIComponent(encodeMriQuery(query, { urlSafe: false }));

  assert.deepEqual(decodeMriQuery(encoded), query);
});
