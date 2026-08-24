import type { Conflict, ContextPack, ContextRecord, SourceType } from "./types.js";

export type RetrievalOptions = {
  evaluationTime?: string;
  timeSensitive?: boolean;
  ttlHours?: Partial<Record<SourceType, number>>;
  entityTags?: string[];
  sourcePrecedence?: SourceType[];
};

export function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function overlap(query: Set<string>, record: ContextRecord): number {
  const haystack = tokens(`${record.text} ${record.entity_tags.join(" ")} ${Object.values(record.facts ?? {}).join(" ")}`);
  return [...query].filter((token) => haystack.has(token)).length;
}

function conflictSet(records: ContextRecord[]): Conflict[] {
  const facts = new Map<string, Map<string, string[]>>();
  for (const record of records) {
    for (const [fact, value] of Object.entries(record.facts ?? {})) {
      const values = facts.get(fact) ?? new Map<string, string[]>();
      values.set(value, [...(values.get(value) ?? []), record.source_id]);
      facts.set(fact, values);
    }
  }
  return [...facts.entries()]
    .filter(([, values]) => values.size > 1)
    .map(([fact, values]) => ({ fact, values: [...values.keys()].sort(), source_ids: [...values.values()].flat().sort() }));
}

export function retrieve(
  current: Record<string, ContextRecord>,
  query: string,
  options: RetrievalOptions = {},
): ContextPack {
  const allRecords = Object.values(current);
  const latestEffective = allRecords
    .map((record) => record.effective_at)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const evaluationTime = options.evaluationTime ?? latestEffective ?? "1970-01-01T00:00:00Z";
  const queryTokens = tokens(query);
  const precedence = options.sourcePrecedence ?? ["docs", "github", "linear", "slack"];
  const expired: string[] = [];
  const eligible = allRecords.filter((record) => {
    if (options.entityTags?.length && !options.entityTags.some((tag) => record.entity_tags.includes(tag))) return false;
    const ttl = options.ttlHours?.[record.source_type];
    if (options.timeSensitive && ttl !== undefined) {
      const ageHours = (Date.parse(evaluationTime) - Date.parse(record.effective_at)) / 3_600_000;
      if (ageHours > ttl) {
        expired.push(record.source_id);
        return false;
      }
    }
    return true;
  });
  eligible.sort((a, b) => {
    const relevance = overlap(queryTokens, b) - overlap(queryTokens, a);
    if (relevance) return relevance;
    const rank = precedence.indexOf(a.source_type) - precedence.indexOf(b.source_type);
    if (rank) return rank;
    const effective = Date.parse(b.effective_at) - Date.parse(a.effective_at);
    return effective || a.source_id.localeCompare(b.source_id);
  });
  return { query, evaluation_time: evaluationTime, sources: eligible, expired_source_ids: expired.sort(), conflicts: conflictSet(eligible) };
}
