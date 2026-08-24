export type SourceType = "docs" | "github" | "linear" | "slack";

export type SourceInput = {
  source_id: string;
  source_type: SourceType;
  locator: string;
  observed_at: string;
  effective_at: string;
  revision: string;
  text: string;
  entity_tags: string[];
  supersedes?: string;
  facts?: Record<string, string>;
};

export type ContextRecord = SourceInput & {
  content_hash: string;
};

export type CandidateClaim = {
  claim_id: string;
  text: string;
  kind: "fact" | "inference";
  source_ids: string[];
  source_hashes: string[];
};

export type ClaimDecision = {
  claim_id: string;
  status: "supported" | "stale" | "unsupported" | "review";
  reasons: string[];
};

export type Conflict = {
  fact: string;
  values: string[];
  source_ids: string[];
};

export type ContextPack = {
  query: string;
  evaluation_time: string;
  sources: ContextRecord[];
  expired_source_ids: string[];
  conflicts: Conflict[];
};

export type IngestOutcome = {
  record: ContextRecord;
  appended: boolean;
  selected_current: boolean;
  reason: "appended_current" | "appended_historical" | "identical_content_ignored";
};

export type ReviewRecord = {
  review_id: string;
  supersedes_claim_id: string;
  corrected_text: string;
  created_at: string;
};
