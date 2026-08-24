import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendReview, readReviews } from "../src/reviews.js";
import { canonicalJson, ContextStore } from "../src/store.js";

test("human correction and rebuilt current index replay deterministically", () => {
  const dir = mkdtempSync(join(tmpdir(), "relay-test-"));
  try {
    const store = new ContextStore(join(dir, "state"));
    const reviewsPath = join(dir, "state", "reviews.jsonl");
    const review = { review_id: "review-001", supersedes_claim_id: "old", corrected_text: "Use the durable rule.", created_at: "2026-08-24T09:00:00Z" };
    assert.equal(appendReview(reviewsPath, review), true);
    assert.equal(appendReview(reviewsPath, review), false);
    const before = canonicalJson({ current: store.rebuildCurrent(), reviews: readReviews(reviewsPath) });
    const after = canonicalJson({ current: store.rebuildCurrent(), reviews: readReviews(reviewsPath) });
    assert.equal(before, after);
    assert.equal(readReviews(reviewsPath)[0].supersedes_claim_id, "old");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
