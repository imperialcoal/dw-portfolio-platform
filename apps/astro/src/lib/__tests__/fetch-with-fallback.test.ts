import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithFallback } from "../fetch-with-fallback";

const ARRAY_FALLBACK = [{ id: "fallback" }];
const arrayParse = (json: unknown) =>
  Array.isArray(json) && json.length > 0
    ? (json as { id: string }[])
    : undefined;

interface Bio {
  short: string;
  long: string;
}
const BIO_FALLBACK: Bio = { short: "fallback-short", long: "fallback-long" };
const bioParse = (json: unknown) => (json as { bio?: Bio }).bio;

describe("fetchWithFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the fallback when baseUrl is undefined", async () => {
    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: undefined,
      path: "/experience",
      parse: arrayParse,
    });
    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when baseUrl is an empty string", async () => {
    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "",
      path: "/experience",
      parse: arrayParse,
    });
    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns live data on a successful non-empty array response (Skills/Experience/Project shape)", async () => {
    const live = [{ id: "live-1" }, { id: "live-2" }];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: () => Promise.resolve(live) }),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toEqual(live);
    expect(fetch).toHaveBeenCalledWith(
      "https://dev.career-data.example.dev/experience",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns the fallback when the array response is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when the array response is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ unexpected: "shape" }),
      }),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns live data on a successful nested-object response (About's /profile shape)", async () => {
    const liveBio: Bio = { short: "live-short", long: "live-long" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bio: liveBio }),
      }),
    );

    const result = await fetchWithFallback(BIO_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/profile",
      parse: bioParse,
    });

    expect(result).toEqual(liveBio);
  });

  it("returns the fallback when the nested-object response has no bio field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );

    const result = await fetchWithFallback(BIO_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/profile",
      parse: bioParse,
    });

    expect(result).toBe(BIO_FALLBACK);
  });

  it("returns the fallback when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve([]) }),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when fetch throws (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            reject(
              new DOMException("The operation was aborted.", "TimeoutError"),
            );
          }),
      ),
    );

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
      timeoutMs: 1,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });
});
