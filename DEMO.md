# 75-second founder demo script

## 0:00–0:10 — The failure boundary

Show the four synthetic fixture folders.

> This tests one narrow problem: when docs, issues, tasks, and discussions change at different times, can an agent use current evidence without silently trusting stale context?

## 0:10–0:23 — Traceable baseline

Show M01 in `evals/results.json`.

> Each context record carries a source ID, canonical SHA-256, effective time, revision, and locator. The baseline retrieves all four current sources with provenance.

## 0:23–0:38 — Mutation and expiry

Show the old and new architecture hashes in M03, then M04.

> Changing the docs invalidates the old citation as `cited_hash_not_current`. A Slack-like status source beyond its TTL becomes unsupported rather than being reused.

## 0:38–0:52 — Conflict and human review

Show M05 and M08.

> Conflicting current sources produce a review item with both source IDs—there is no silent winner. An append-only human correction then survives rebuilding the current index and blocks the superseded claim.

## 0:52–1:05 — The bug the harness caught

Show the nondeterminism section in `RESULT.md`.

> The first run found a real bug in my harness: wall-clock timestamps broke byte-for-byte replay. I fixed the as-of-time rule without changing the fixtures or expected results, then reran everything.

## 1:05–1:15 — Result and boundary

Show the result table.

> Eight of eight cases now score ten, with no stale, expired, or unsupported fact accepted and identical clean replays. This is a synthetic reliability fixture—not a test of anyone else's production system.
