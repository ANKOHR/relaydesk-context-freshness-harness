import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { SourceInput } from "./types.js";

function validate(input: SourceInput): SourceInput {
  const required = ["source_id", "source_type", "locator", "observed_at", "effective_at", "revision", "text"] as const;
  for (const field of required) if (!input[field]) throw new Error(`missing source field: ${field}`);
  const url = new URL(input.locator);
  if (url.hostname !== "example.invalid") throw new Error(`non-fixture locator rejected: ${url.hostname}`);
  if (!Array.isArray(input.entity_tags)) throw new Error("entity_tags must be an array");
  return input;
}

function markdownInput(text: string): SourceInput {
  const normalised = text.replace(/\r\n?/g, "\n");
  const match = normalised.match(/^---\n([^\n]+)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("markdown fixture requires a one-line JSON header");
  const metadata = JSON.parse(match[1]) as Omit<SourceInput, "text">;
  return validate({ ...metadata, text: match[2].trim() });
}

export function loadSource(path: string): SourceInput {
  const raw = readFileSync(path, "utf8");
  if (extname(path).toLowerCase() === ".md") return markdownInput(raw);
  return validate(JSON.parse(raw) as SourceInput);
}
