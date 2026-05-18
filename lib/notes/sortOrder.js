import {
  generateKeyBetween as fracKeyBetween,
  generateNKeysBetween as fracNKeysBetween,
} from "fractional-indexing";

// Fractional indexing assigns lexicographic string keys between any two
// neighbours. Two concurrent inserts under the same parent may compute the
// same key (both read identical neighbours); the (sortOrder, _id) compound
// sort breaks the tie deterministically — no jitter / unique index needed.
// See: https://github.com/rocicorp/fractional-indexing

export function generateKeyBetween(prev, next) {
  return fracKeyBetween(prev ?? null, next ?? null);
}

export function generateKeyAfter(prev) {
  return fracKeyBetween(prev ?? null, null);
}

export function generateKeyBefore(next) {
  return fracKeyBetween(null, next ?? null);
}

export function generateNKeysBetween(prev, next, n) {
  return fracNKeysBetween(prev ?? null, next ?? null, n);
}
