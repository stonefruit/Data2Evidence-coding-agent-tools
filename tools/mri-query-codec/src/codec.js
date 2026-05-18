import { deflateSync, inflateSync } from "node:zlib";

function normalizeBase64(input) {
  const decoded = decodeURIComponent(input.trim());
  const standard = decoded.replace(/-/g, "+").replace(/_/g, "/");
  const padding = standard.length % 4 === 0 ? "" : "=".repeat(4 - (standard.length % 4));
  return `${standard}${padding}`;
}

export function decodeMriQuery(input) {
  const compressed = Buffer.from(normalizeBase64(input), "base64");
  return JSON.parse(inflateSync(compressed).toString("utf8"));
}

export function encodeMriQuery(value, { urlSafe = true } = {}) {
  const compressed = deflateSync(JSON.stringify(value));
  const base64 = compressed.toString("base64");

  if (!urlSafe) {
    return base64;
  }

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
