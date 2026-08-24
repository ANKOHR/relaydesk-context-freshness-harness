import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { canonicalJson, readJsonl } from "./store.js";
import type { ReviewRecord } from "./types.js";

export function appendReview(path: string, review: ReviewRecord): boolean {
  const reviews = readJsonl<ReviewRecord>(path);
  if (reviews.some((item) => item.review_id === review.review_id)) return false;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${canonicalJson(review)}\n`, "utf8");
  return true;
}

export function readReviews(path: string): ReviewRecord[] {
  return readJsonl<ReviewRecord>(path);
}
