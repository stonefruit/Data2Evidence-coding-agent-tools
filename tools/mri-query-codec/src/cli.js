#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decodeMriQuery, encodeMriQuery } from "./codec.js";

function readStdin() {
  return readFileSync(0, "utf8").trim();
}

function usage() {
  console.error("Usage: mri-query-codec <decode|encode|encode-standard> [payload]");
  console.error("If payload is omitted, input is read from stdin.");
}

const [command, payloadArg] = process.argv.slice(2);
const payload = payloadArg ?? readStdin();

try {
  if (command === "decode") {
    console.log(JSON.stringify(decodeMriQuery(payload), null, 2));
  } else if (command === "encode") {
    console.log(encodeMriQuery(JSON.parse(payload), { urlSafe: true }));
  } else if (command === "encode-standard") {
    console.log(encodeMriQuery(JSON.parse(payload), { urlSafe: false }));
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
