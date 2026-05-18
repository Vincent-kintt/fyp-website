import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeGeolocation,
  executeReverseGeocode,
  getCacheKey,
} from "@/lib/reminders/aiReminderModalLocation.js";

describe("aiReminderModalLocation helpers", () => {
  describe("getCacheKey", () => {
    it("returns distinct keys for the same coords in different languages", () => {
      const coords = { latitude: 22.3193, longitude: 114.1694 };
      expect(getCacheKey(coords, "en")).not.toBe(getCacheKey(coords, "zh"));
    });

    it("returns identical keys for identical coords and language", () => {
      const coords = { latitude: 22.3193, longitude: 114.1694 };
      expect(getCacheKey(coords, "en")).toBe(getCacheKey(coords, "en"));
    });

    it("differs when coords differ", () => {
      const a = { latitude: 22.3193, longitude: 114.1694 };
      const b = { latitude: 25.033, longitude: 121.5654 };
      expect(getCacheKey(a, "en")).not.toBe(getCacheKey(b, "en"));
    });
  });

  describe("executeGeolocation", () => {
    let log;
    beforeEach(() => {
      log = vi.fn();
    });

    it("resolves with coords on success", async () => {
      const navigator = {
        geolocation: {
          getCurrentPosition: (onSuccess) => {
            onSuccess({
              coords: { latitude: 22.3193, longitude: 114.1694 },
            });
          },
        },
      };
      const result = await executeGeolocation({ navigator, log });
      expect(result).toEqual({ latitude: 22.3193, longitude: 114.1694 });
    });

    it("resolves with null on permission denial", async () => {
      const navigator = {
        geolocation: {
          getCurrentPosition: (_onSuccess, onError) => {
            onError({ code: 1, message: "denied" });
          },
        },
      };
      const result = await executeGeolocation({ navigator, log });
      expect(result).toBeNull();
      expect(log).toHaveBeenCalled();
    });

    it("resolves with null when geolocation API is unavailable", async () => {
      const navigator = {};
      const result = await executeGeolocation({ navigator, log });
      expect(result).toBeNull();
    });

    it("passes maximumAge and timeout options through", async () => {
      const spy = vi.fn((onSuccess) => {
        onSuccess({ coords: { latitude: 1, longitude: 2 } });
      });
      const navigator = { geolocation: { getCurrentPosition: spy } };
      await executeGeolocation({ navigator, log });
      const opts = spy.mock.calls[0][2];
      expect(opts).toMatchObject({
        enableHighAccuracy: false,
        timeout: expect.any(Number),
        maximumAge: expect.any(Number),
      });
    });
  });

  describe("executeReverseGeocode", () => {
    const coords = { latitude: 22.3193, longitude: 114.1694 };
    let log, cache;

    beforeEach(() => {
      log = vi.fn();
      const store = new Map();
      cache = {
        get: (k) => store.get(k) ?? null,
        set: (k, v) => store.set(k, v),
      };
    });

    it("returns cached value on cache hit", async () => {
      const cached = { city: "Hong Kong", country: "HK" };
      cache.set(getCacheKey(coords, "en"), cached);
      const fetchFn = vi.fn();
      const result = await executeReverseGeocode({
        coords,
        language: "en",
        fetch: fetchFn,
        cache,
        log,
      });
      expect(result).toEqual(cached);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("fetches with the right accept-language header for zh", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        json: async () => ({
          address: { city: "香港", country: "中國" },
        }),
      });
      await executeReverseGeocode({
        coords,
        language: "zh",
        fetch: fetchFn,
        cache,
        log,
      });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const url = fetchFn.mock.calls[0][0];
      expect(url).toContain("accept-language=zh-TW");
      expect(url).toContain("lat=22.3193");
      expect(url).toContain("lon=114.1694");
    });

    it("fetches with the right accept-language header for en", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        json: async () => ({ address: { city: "Hong Kong" } }),
      });
      await executeReverseGeocode({
        coords,
        language: "en",
        fetch: fetchFn,
        cache,
        log,
      });
      const url = fetchFn.mock.calls[0][0];
      expect(url).toContain("accept-language=en");
    });

    it("caches the result under the language-specific key", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        json: async () => ({ address: { city: "Hong Kong", country: "HK" } }),
      });
      await executeReverseGeocode({
        coords,
        language: "en",
        fetch: fetchFn,
        cache,
        log,
      });
      const stored = cache.get(getCacheKey(coords, "en"));
      expect(stored).toMatchObject({ city: "Hong Kong", country: "HK" });
      // Other language slot remains empty (bug-fix invariant).
      expect(cache.get(getCacheKey(coords, "zh"))).toBeNull();
    });

    it("returns null and logs on fetch failure", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("network down"));
      const result = await executeReverseGeocode({
        coords,
        language: "en",
        fetch: fetchFn,
        cache,
        log,
      });
      expect(result).toBeNull();
      expect(log).toHaveBeenCalled();
    });

    it("returns null when coords are missing", async () => {
      const result = await executeReverseGeocode({
        coords: null,
        language: "en",
        fetch: vi.fn(),
        cache,
        log,
      });
      expect(result).toBeNull();
    });

    it("extracts city from town/village fallbacks", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        json: async () => ({
          address: { village: "Stanley", country: "HK" },
        }),
      });
      const result = await executeReverseGeocode({
        coords,
        language: "en",
        fetch: fetchFn,
        cache,
        log,
      });
      expect(result.city).toBe("Stanley");
    });
  });
});
