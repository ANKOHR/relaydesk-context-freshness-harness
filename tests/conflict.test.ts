import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { evaluateClaim } from "../src/evaluate.js";
import { loadSource } from "../src/ingest.js";
import { retrieve } from "../src/retrieve.js";
import { ContextStore } from "../src/store.js";

const root = resolve(".");

test("mutation invalidates old hash and current disagreement requires review", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
  try {
    const store = new ContextStore(dir);
    const old = store.ingest(loadSource(join(root, "fixture", "docs", "architecture.md"))).record;
    const claim = { claim_id: "old", text: "after", kind: "fact" as const, source_ids: [old.source_id], source_hashes: [old.content_hash] };
    store.ingest(loadSource(join(root, "fixture", "mutations", "architecture-v2.md")));
    const pack = retrieve(store.current(), "acknowledgement");
    assert.equal(evaluateClaim(claim, pack, store.current()).status, "stale");
    const conflict = store.ingest(loadSource(join(root, "fixture", "mutations", "issue-17-conflict.json"))).record;
    const current = store.current()[old.source_id];
    const conflictedPack = retrieve(store.current(), "acknowledgement");
    const conflicted = { ...claim, source_ids: [current.source_id, conflict.source_id], source_hashes: [current.content_hash, conflict.content_hash] };
    assert.equal(evaluateClaim(conflicted, conflictedPack, store.current()).status, "review");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("TTL expiry applies only to time-sensitive retrieval", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
  try {
    const store = new ContextStore(dir);
    store.ingest(loadSource(join(root, "fixture", "mutations", "thread-42-stale.json")));
    const options = { evaluationTime: "2026-08-24T09:00:00Z", ttlHours: { slack: 48 } } as const;
    assert.equal(retrieve(store.current(), "release", { ...options, timeSensitive: false }).sources.length, 1);
    assert.deepEqual(retrieve(store.current(), "release", { ...options, timeSensitive: true }).expired_source_ids, ["slack:thread-42"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
