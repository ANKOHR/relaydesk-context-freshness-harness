# Context-freshness validation result

Run 24 August 2026 · local synthetic fixture · no network or hosted model

## Result first

The final harness clears its predefined usefulness gate.

| Measure | Result | Gate |
|---|---:|---:|
| Cases scoring at least 8/10 | 8/8 | at least 7/8 |
| Mean score | 10/10 | informational |
| Stale or expired claims accepted | 0 | 0 |
| Unsupported facts accepted | 0 | 0 |
| Clean replay identical | yes | yes |
| Privacy findings | 0 | 0 |

This validates the synthetic context-layer implementation, not any production system.

## What the harness demonstrates

- Four source types retain source ID, canonical SHA-256, effective time, revision and locator.
- Re-ingesting identical content adds no revision and returns the same normalized context pack.
- A source mutation changes the current hash and makes an old citation stale.
- A Slack-like source beyond a case-specific TTL cannot support a time-sensitive claim.
- Conflicting current facts are returned for review with both source IDs; no silent winner is chosen.
- A later-arriving but earlier-effective Linear-like event remains historical.
- A factual claim with no current citation is unsupported.
- A human correction survives current-index reconstruction and blocks the superseded conclusion.

## Defect found during implementation

The first evaluation exposed wall-clock nondeterminism in otherwise identical context packs: retrieval used the current clock when no evaluation time was provided. That made M01 and M02 score 9 rather than 10.

The fix did not change fixture expectations. Non-time-sensitive retrieval now uses the latest effective source time as its deterministic as-of value; time-sensitive cases still require an explicit evaluation time. The complete test and evaluation suite was rerun after the change.

## Strongest founder-facing sequence

The most legible proof is M03 → M05 → M08:

1. ingest architecture v1 and preserve its hash;
2. ingest v2 and show the v1 citation becomes `stale` with `cited_hash_not_current`;
3. introduce a current conflicting issue and show `review` with both sources;
4. append a human correction, rebuild from JSONL, and show the correction still blocks the superseded claim.

## Honest limitations

- Source facts are structured in tiny local fixtures; real connectors and messy content are not tested.
- Retrieval is deterministic token overlap, not semantic search or generated prose.
- Conflict detection compares declared fact keys and does not infer contradictions from arbitrary language.
- The suite tests reliability boundaries, not drafting quality, scale, latency, access controls, or an external product.

The appropriate claim is: this is a compact, reproducible demonstration that a builder can identify and implement the freshness, provenance, conflict, and correction boundaries a multi-source context product needs.
