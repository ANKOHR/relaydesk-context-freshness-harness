import type { CandidateClaim, ClaimDecision, ContextPack, ContextRecord, ReviewRecord } from "./types.js";

export function evaluateClaim(
  claim: CandidateClaim,
  pack: ContextPack,
  current: Record<string, ContextRecord>,
  reviews: ReviewRecord[] = [],
): ClaimDecision {
  if (reviews.some((review) => review.supersedes_claim_id === claim.claim_id)) {
    return { claim_id: claim.claim_id, status: "review", reasons: ["durable_human_correction"] };
  }
  if (!claim.source_ids.length || claim.source_ids.length !== claim.source_hashes.length) {
    return { claim_id: claim.claim_id, status: "unsupported", reasons: ["no_current_evidence"] };
  }
  if (claim.source_ids.some((id) => pack.expired_source_ids.includes(id))) {
    return { claim_id: claim.claim_id, status: "unsupported", reasons: ["source_ttl_expired"] };
  }
  for (let index = 0; index < claim.source_ids.length; index += 1) {
    const record = current[claim.source_ids[index]];
    if (!record) return { claim_id: claim.claim_id, status: "unsupported", reasons: ["no_current_evidence"] };
    if (record.content_hash !== claim.source_hashes[index]) {
      return { claim_id: claim.claim_id, status: "stale", reasons: ["cited_hash_not_current"] };
    }
  }
  const cited = new Set(claim.source_ids);
  if (pack.conflicts.some((conflict) => conflict.source_ids.some((id) => cited.has(id)))) {
    return { claim_id: claim.claim_id, status: "review", reasons: ["current_sources_disagree"] };
  }
  return { claim_id: claim.claim_id, status: "supported", reasons: [claim.kind === "inference" ? "labelled_inference_with_current_evidence" : "current_evidence"] };
}
