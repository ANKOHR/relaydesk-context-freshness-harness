# Multi-source context freshness — proof summary

## Question

When engineering context changes across docs, GitHub-like issues, Linear-like tasks, and Slack-like discussions, can an agent-facing context layer return current, source-linked evidence without silently accepting stale conclusions?

## Built

A 307-line TypeScript core using wholly synthetic `RelayDesk` data:

- canonical SHA-256 content hashes and append-only JSONL revisions;
- `effective_at` freshness selection independent of arrival order;
- stale-citation invalidation and case-specific TTL expiry;
- explicit review when current sources disagree;
- durable, idempotent human corrections;
- deterministic retrieval and machine-readable reason codes.

## Result

- 8/8 fixed cases at 10/10;
- zero stale or expired claims accepted;
- zero unsupported factual claims accepted;
- byte-identical clean replay;
- tests, strict typecheck, and production build pass;
- zero fixture/output privacy findings.

The first run caught wall-clock nondeterminism in the harness itself. The as-of-time rule was corrected without changing fixtures or expected outcomes, and the entire suite was rerun.

## Boundaries

This uses structured synthetic fixtures and deterministic token overlap. It does not test real connectors, customer data, semantic retrieval, generated prose, scale, access control, or any external production system.
