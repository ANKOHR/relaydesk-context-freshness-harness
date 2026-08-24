---
{"source_id":"docs:architecture","source_type":"docs","locator":"https://example.invalid/docs/architecture","observed_at":"2026-08-24T08:00:00Z","effective_at":"2026-08-24T07:45:00Z","revision":"architecture-v2","entity_tags":["relaydesk","durable-receipts","acknowledgement"],"facts":{"ack_timing":"after_persistence","approval_boundary":"human_required"},"supersedes":"architecture-v1"}
---
RelayDesk writes and verifies a durable job receipt before acknowledging acceptance. Receipts include an idempotency key, canonical content hash, and recovery status. External actions remain blocked until a human approves them.
