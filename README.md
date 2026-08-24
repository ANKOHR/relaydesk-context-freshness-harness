# Deterministic multi-source context-freshness harness

Can an agent-facing context layer gather changing information from docs, GitHub-like issues, Linear-like tasks, and Slack-like discussions without quietly trusting stale evidence?

This TypeScript harness tests that failure boundary with fixed, inspectable cases: canonical content hashes, append-only revisions, stale-citation rejection, TTL expiry, explicit conflict review, and durable human corrections.

The product and people are fictional. `RelayDesk` uses synthetic fixture files with `example.invalid` locators. The harness does not connect to any real service or hosted model.

## Result

**8/8 fixed evaluations score 10/10.** The final run accepts no stale, expired, or unsupported factual claim, produces byte-identical clean replays, and has zero privacy findings.

See:

- `evals/results.json` for machine-readable evidence;
- `RESULT.md` for the bounded assessment;
- `DEMO.md` for the short walkthrough sequence.

## Verify

```powershell
npm install
npm run typecheck
npm test
npm run eval
npm run build
```

The test suite covers stable canonical hashing, idempotent ingestion, effective-time ordering, stale hashes, TTL filtering, current-source conflicts, and durable review replay.

## Architecture

- `src/ingest.ts` parses only the local fixture formats and rejects non-`example.invalid` locators.
- `src/store.ts` appends canonical records to JSONL and rebuilds a current index using `effective_at` before arrival time.
- `src/retrieve.ts` performs deterministic token-overlap retrieval, TTL filtering, ranking, and fact-conflict detection.
- `src/evaluate.ts` classifies structured claims as supported, stale, unsupported, or review.
- `src/reviews.ts` persists idempotent human corrections.

This is a reliability fixture, not an external product benchmark, semantic-retrieval evaluation, security audit, or production connector.
