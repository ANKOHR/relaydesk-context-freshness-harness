import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { loadSource } from "../src/ingest.js";
import { canonicalJson, contentHash, ContextStore } from "../src/store.js";

const root = resolve(".");

test("canonical hashes survive key order and CRLF changes", () => {
  const source = loadSource(join(root, "fixture", "linear", "TASK-42.json"));
  const reordered = { ...source, text: source.text.replace(/\n/g, "\r\n"), facts: { target_release: "2026-09", task_state: "verified" } };
  assert.equal(contentHash(source), contentHash(reordered));
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("identical content is idempotent and older effective time cannot regress current", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
  try {
    const store = new ContextStore(dir);
    const current = loadSource(join(root, "fixture", "linear", "TASK-42.json"));
    assert.equal(store.ingest(current).appended, true);
    assert.equal(store.ingest(current).appended, false);
    const old = store.ingest(loadSource(join(root, "fixture", "mutations", "task-42-older.json")));
    assert.equal(old.reason, "appended_historical");
    assert.equal(store.current()[current.source_id].revision, "task-42-v2");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
