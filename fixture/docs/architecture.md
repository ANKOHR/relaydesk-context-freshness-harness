---
{"source_id":"docs:architecture","source_type":"docs","locator":"https://example.invalid/docs/architecture","observed_at":"2026-08-20T10:00:00Z","effective_at":"2026-08-20T09:00:00Z","revision":"architecture-v1","entity_tags":["relaydesk","durable-receipts","acknowledgement"],"facts":{"ack_timing":"after_persistence","approval_boundary":"human_required"}}
---
RelayDesk persists a durable job receipt before acknowledging acceptance. Every receipt carries an idempotency key and a content hash. Actions that leave the system require explicit human approval.
