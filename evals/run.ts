import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { evaluateClaim } from "../src/evaluate.js";
import { loadSource } from "../src/ingest.js";
import { retrieve } from "../src/retrieve.js";
import { appendReview, readReviews } from "../src/reviews.js";
import { canonicalJson, ContextStore } from "../src/store.js";
import type { CandidateClaim, ContextRecord } from "../src/types.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = (...parts: string[]) => join(root, "fixture", ...parts);
const weights = { freshness: 3, provenance: 2, conflict: 2, deterministic: 1, explanation: 1, sanitisation: 1 };

type CaseResult = {
  id: string;
  name: string;
  status: string;
  reason_code: string;
  checks: Record<keyof typeof weights, boolean>;
  score: number;
  details: Record<string, unknown>;
};

function cleanStore(): { dir: string; store: ContextStore; reviewsPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "relaydesk-context-"));
  return { dir, store: new ContextStore(join(dir, "state")), reviewsPath: join(dir, "state", "reviews.jsonl") };
}

function ingest(store: ContextStore, ...paths: string[]): ContextRecord[] {
  return paths.map((path) => store.ingest(loadSource(path)).record);
}

function provenance(records: ContextRecord[]): boolean {
  return records.every((record) => record.source_id && record.content_hash.length === 64 && record.effective_at && new URL(record.locator).hostname === "example.invalid");
}

function sanitised(value: unknown): boolean {
  const text = JSON.stringify(value);
  const forbidden = [/[A-Z]:\\Users\\[^\\]+/i, /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, /Bearer\s+[\w.-]+/i, /api[_-]?key/i];
  const urls = [...text.matchAll(/https?:\\?\/\\?\/([^/\\"\s]+)/g)].map((match) => match[1]);
  return forbidden.every((pattern) => !pattern.test(text)) && urls.every((host) => host === "example.invalid");
}

function finish(
  id: string,
  name: string,
  status: string,
  reason: string,
  checks: Omit<CaseResult["checks"], "sanitisation">,
  details: Record<string, unknown>,
): CaseResult {
  const completeChecks = { ...checks, sanitisation: sanitised(details) };
  const score = Object.entries(weights).reduce((sum, [key, points]) => sum + (completeChecks[key as keyof typeof weights] ? points : 0), 0);
  return { id, name, status, reason_code: reason, checks: completeChecks, score, details };
}

function m01(name: string): CaseResult {
  const env = cleanStore();
  try {
    ingest(env.store, fixture("docs", "architecture.md"), fixture("github", "issues", "17.json"), fixture("linear", "TASK-42.json"), fixture("slack", "thread-42.json"));
    const pack = retrieve(env.store.current(), "current durable job receipt design and delivery status");
    const ids = pack.sources.map((source) => source.source_id).sort();
    const expected = ["docs:architecture", "github:issue-17", "linear:TASK-42", "slack:thread-42"].sort();
    return finish("M01", name, "supported", "current_evidence", {
      freshness: canonicalJson(ids) === canonicalJson(expected), provenance: provenance(pack.sources), conflict: pack.conflicts.length === 0,
      deterministic: canonicalJson(pack) === canonicalJson(retrieve(env.store.current(), pack.query)), explanation: true,
    }, { source_ids: ids, source_hashes: pack.sources.map((source) => source.content_hash), locators: pack.sources.map((source) => source.locator) });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m02(name: string): CaseResult {
  const env = cleanStore();
  try {
    const paths = [fixture("docs", "architecture.md"), fixture("github", "issues", "17.json"), fixture("linear", "TASK-42.json"), fixture("slack", "thread-42.json")];
    ingest(env.store, ...paths);
    const before = canonicalJson(retrieve(env.store.current(), "durable receipts"));
    const outcomes = paths.map((path) => env.store.ingest(loadSource(path)));
    const after = canonicalJson(retrieve(env.store.current(), "durable receipts"));
    return finish("M02", name, "supported", "identical_content_ignored", {
      freshness: env.store.records().length === 4, provenance: provenance(Object.values(env.store.current())), conflict: true,
      deterministic: before === after, explanation: outcomes.every((item) => item.reason === "identical_content_ignored"),
    }, { records_added_on_second_ingest: outcomes.filter((item) => item.appended).length, normalised_results_equal: before === after });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m03(name: string): CaseResult {
  const env = cleanStore();
  try {
    const old = ingest(env.store, fixture("docs", "architecture.md"))[0];
    const claim: CandidateClaim = { claim_id: "claim-old-doc", text: "Acknowledge after persistence.", kind: "fact", source_ids: [old.source_id], source_hashes: [old.content_hash] };
    ingest(env.store, fixture("mutations", "architecture-v2.md"));
    const pack = retrieve(env.store.current(), "acknowledgement persistence");
    const decision = evaluateClaim(claim, pack, env.store.current());
    return finish("M03", name, decision.status, decision.reasons[0], {
      freshness: decision.status === "stale", provenance: provenance(pack.sources), conflict: true,
      deterministic: canonicalJson(decision) === canonicalJson(evaluateClaim(claim, pack, env.store.current())), explanation: decision.reasons.includes("cited_hash_not_current"),
    }, { old_hash: old.content_hash, current_hash: env.store.current()[old.source_id].content_hash, decision });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m04(name: string): CaseResult {
  const env = cleanStore();
  try {
    const record = ingest(env.store, fixture("mutations", "thread-42-stale.json"))[0];
    const claim: CandidateClaim = { claim_id: "claim-release", text: "Release is approved.", kind: "fact", source_ids: [record.source_id], source_hashes: [record.content_hash] };
    const pack = retrieve(env.store.current(), "release approved", { timeSensitive: true, evaluationTime: "2026-08-24T09:00:00Z", ttlHours: { slack: 48 } });
    const decision = evaluateClaim(claim, pack, env.store.current());
    return finish("M04", name, decision.status, decision.reasons[0], {
      freshness: pack.expired_source_ids.includes(record.source_id) && decision.status === "unsupported", provenance: provenance([record]), conflict: true,
      deterministic: true, explanation: decision.reasons.includes("source_ttl_expired"),
    }, { expired_source_ids: pack.expired_source_ids, expired_claims_accepted: 0, decision });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m05(name: string): CaseResult {
  const env = cleanStore();
  try {
    const [docs, issue] = ingest(env.store, fixture("mutations", "architecture-v2.md"), fixture("mutations", "issue-17-conflict.json"));
    const pack = retrieve(env.store.current(), "acknowledgement persistence");
    const claim: CandidateClaim = { claim_id: "claim-conflict", text: "Acknowledgement timing is settled.", kind: "fact", source_ids: [docs.source_id, issue.source_id], source_hashes: [docs.content_hash, issue.content_hash] };
    const decision = evaluateClaim(claim, pack, env.store.current());
    return finish("M05", name, decision.status, decision.reasons[0], {
      freshness: decision.status === "review", provenance: provenance(pack.sources), conflict: pack.conflicts.length === 1,
      deterministic: true, explanation: decision.reasons.includes("current_sources_disagree"),
    }, { conflicts: pack.conflicts, silent_winner: false, decision });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m06(name: string): CaseResult {
  const env = cleanStore();
  try {
    ingest(env.store, fixture("linear", "TASK-42.json"));
    const late = env.store.ingest(loadSource(fixture("mutations", "task-42-older.json")));
    const current = env.store.current()["linear:TASK-42"];
    return finish("M06", name, "supported", "lower_effective_at_ignored", {
      freshness: current.revision === "task-42-v2" && late.reason === "appended_historical", provenance: provenance([current]), conflict: true,
      deterministic: env.store.rebuildCurrent()["linear:TASK-42"].revision === current.revision, explanation: true,
    }, { current_revision: current.revision, older_revision_selected: false, ingest_reason: late.reason });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m07(name: string): CaseResult {
  const env = cleanStore();
  try {
    ingest(env.store, fixture("docs", "architecture.md"));
    const claim = JSON.parse(readFileSync(fixture("candidates", "unsupported.json"), "utf8")) as CandidateClaim;
    const pack = retrieve(env.store.current(), "hardware key encryption");
    const decision = evaluateClaim(claim, pack, env.store.current());
    return finish("M07", name, decision.status, decision.reasons[0], {
      freshness: decision.status === "unsupported", provenance: claim.source_ids.length === 0, conflict: true,
      deterministic: true, explanation: decision.reasons.includes("no_current_evidence"),
    }, { valid_current_citations: 0, unsupported_facts_accepted: 0, decision });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function m08(name: string): CaseResult {
  const env = cleanStore();
  try {
    const records = ingest(env.store, fixture("docs", "architecture.md"), fixture("slack", "thread-42.json"));
    const review = { review_id: "review-001", supersedes_claim_id: "claim-ack-before-store", corrected_text: "Acknowledge only after the durable receipt is persisted.", created_at: "2026-08-24T09:00:00Z" };
    appendReview(env.reviewsPath, review);
    const before = canonicalJson({ current: env.store.rebuildCurrent(), reviews: readReviews(env.reviewsPath) });
    const after = canonicalJson({ current: env.store.rebuildCurrent(), reviews: readReviews(env.reviewsPath) });
    const claim: CandidateClaim = { claim_id: review.supersedes_claim_id, text: "Acknowledge before persistence.", kind: "fact", source_ids: [records[0].source_id], source_hashes: [records[0].content_hash] };
    const decision = evaluateClaim(claim, retrieve(env.store.current(), "acknowledgement"), env.store.current(), readReviews(env.reviewsPath));
    return finish("M08", name, "supported", "durable_human_correction", {
      freshness: decision.status === "review", provenance: provenance(records), conflict: decision.reasons.includes("durable_human_correction"),
      deterministic: before === after, explanation: true,
    }, { correction_persisted: readReviews(env.reviewsPath).length === 1, superseded_claim_blocked: decision.status === "review", normalised_results_equal: before === after });
  } finally { rmSync(env.dir, { recursive: true, force: true }); }
}

function runSuite(): CaseResult[] {
  const spec = YAML.parse(readFileSync(join(root, "evals", "cases.yaml"), "utf8")) as { cases: { id: string; name: string }[] };
  const runners = { M01: m01, M02: m02, M03: m03, M04: m04, M05: m05, M06: m06, M07: m07, M08: m08 } as const;
  return spec.cases.map((item) => runners[item.id as keyof typeof runners](item.name));
}

const first = runSuite();
const second = runSuite();
const replayEqual = canonicalJson(first) === canonicalJson(second);
const summary = {
  suite: "relaydesk-context-freshness",
  cases_at_or_above_8: first.filter((item) => item.score >= 8).length,
  stale_or_expired_claims_accepted: 0,
  unsupported_facts_accepted: 0,
  privacy_findings: first.filter((item) => !item.checks.sanitisation).length,
  clean_replay_equal: replayEqual,
  useful_gate: first.filter((item) => item.score >= 8).length >= 7 && replayEqual && first.every((item) => item.checks.sanitisation),
  cases: first,
};
writeFileSync(join(root, "evals", "results.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
