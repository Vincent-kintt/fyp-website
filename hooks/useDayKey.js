"use client";
import { useSyncExternalStore } from "react";

export function msUntilNextMidnight(from = new Date()) {
  const next = new Date(from);
  next.setHours(24, 0, 0, 100);
  return next.getTime() - from.getTime();
}

export function currentDayKey(from = new Date()) {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const listeners = new Set();
let cachedKey = currentDayKey();
let timerId = null;

function refresh() {
  const fresh = currentDayKey();
  if (fresh !== cachedKey) {
    cachedKey = fresh;
    listeners.forEach((cb) => cb());
  }
}

function scheduleMidnight() {
  if (timerId !== null) clearTimeout(timerId);
  timerId = setTimeout(() => {
    timerId = null;
    refresh();
    if (listeners.size > 0) scheduleMidnight();
  }, msUntilNextMidnight());
}

function subscribe(callback) {
  listeners.add(callback);
  refresh();
  if (timerId === null) scheduleMidnight();
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}

function getSnapshot() {
  return cachedKey;
}

function getServerSnapshot() {
  return cachedKey;
}

export function useDayKey() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const _internals = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  reset() {
    listeners.clear();
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    cachedKey = currentDayKey();
  },
  getListenerCount: () => listeners.size,
  getTimerId: () => timerId,
};
