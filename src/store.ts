import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ContextRecord, IngestOutcome, SourceInput } from "./types.js";

function normalise(value: unknown): unknown {
  if (typeof value === "string") return value.replace(/\r\n?/g, "\n");
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalise(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}

export function contentHash(input: SourceInput): string {
  const content = { text: input.text, facts: input.facts ?? {}, entity_tags: [...input.entity_tags].sort() };
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export class ContextStore {
  readonly recordsPath: string;
  readonly currentPath: string;

  constructor(readonly stateDir: string) {
    this.recordsPath = join(stateDir, "records.jsonl");
    this.currentPath = join(stateDir, "current.json");
    mkdirSync(stateDir, { recursive: true });
  }

  records(): ContextRecord[] {
    return readJsonl<ContextRecord>(this.recordsPath);
  }

  current(): Record<string, ContextRecord> {
    if (!existsSync(this.currentPath)) return this.rebuildCurrent();
    return JSON.parse(readFileSync(this.currentPath, "utf8")) as Record<string, ContextRecord>;
  }

  ingest(input: SourceInput): IngestOutcome {
    const record: ContextRecord = { ...input, content_hash: contentHash(input) };
    const prior = this.records();
    const identical = prior.find(
      (item) => item.source_id === record.source_id && item.content_hash === record.content_hash,
    );
    if (identical) {
      return { record: identical, appended: false, selected_current: this.current()[record.source_id]?.content_hash === identical.content_hash, reason: "identical_content_ignored" };
    }
    mkdirSync(dirname(this.recordsPath), { recursive: true });
    appendFileSync(this.recordsPath, `${canonicalJson(record)}\n`, "utf8");
    const current = this.rebuildCurrent();
    const selected = current[record.source_id]?.content_hash === record.content_hash;
    return { record, appended: true, selected_current: selected, reason: selected ? "appended_current" : "appended_historical" };
  }

  rebuildCurrent(): Record<string, ContextRecord> {
    const current: Record<string, ContextRecord> = {};
    for (const record of this.records()) {
      const previous = current[record.source_id];
      if (!previous || compareRevision(record, previous) > 0) current[record.source_id] = record;
    }
    writeFileSync(this.currentPath, `${canonicalJson(current)}\n`, "utf8");
    return current;
  }
}

function compareRevision(a: ContextRecord, b: ContextRecord): number {
  const effective = Date.parse(a.effective_at) - Date.parse(b.effective_at);
  if (effective !== 0) return effective;
  const observed = Date.parse(a.observed_at) - Date.parse(b.observed_at);
  if (observed !== 0) return observed;
  return a.revision.localeCompare(b.revision);
}
