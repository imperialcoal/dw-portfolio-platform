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

// Minimal shape of what fetchWithFallback actually reads off a Response —
// avoids pulling in the full lib.dom Response type just to mock it, while
// still typing the mock explicitly enough that no `any` ever gets assigned.
interface MockResponse {
  ok: boolean;
  json: () => Promise<unknown>;
}

function mockFetchResolvedWith(response: MockResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<(...args: Parameters<typeof fetch>) => Promise<MockResponse>>(() =>
      Promise.resolve(response),
    ),
  );
}

function mockFetchRejectedWith(error: Error): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<(...args: Parameters<typeof fetch>) => Promise<MockResponse>>(() =>
      Promise.reject(error),
    ),
  );
}

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
    mockFetchResolvedWith({ ok: true, json: () => Promise.resolve(live) });

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toEqual(live);
    expect(fetch).toHaveBeenCalledWith(
      "https://dev.career-data.example.dev/experience",
      expect.anything(),
    );
    const [, options] = vi.mocked(fetch).mock.calls.at(0) ?? [];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the fallback when the array response is empty", async () => {
    mockFetchResolvedWith({ ok: true, json: () => Promise.resolve([]) });

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when the array response is not an array", async () => {
    mockFetchResolvedWith({
      ok: true,
      json: () => Promise.resolve({ unexpected: "shape" }),
    });

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns live data on a successful nested-object response (About's /profile shape)", async () => {
    const liveBio: Bio = { short: "live-short", long: "live-long" };
    mockFetchResolvedWith({
      ok: true,
      json: () => Promise.resolve({ bio: liveBio }),
    });

    const result = await fetchWithFallback(BIO_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/profile",
      parse: bioParse,
    });

    expect(result).toEqual(liveBio);
  });

  it("returns the fallback when the nested-object response has no bio field", async () => {
    mockFetchResolvedWith({ ok: true, json: () => Promise.resolve({}) });

    const result = await fetchWithFallback(BIO_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/profile",
      parse: bioParse,
    });

    expect(result).toBe(BIO_FALLBACK);
  });

  it("returns the fallback when the response is not ok", async () => {
    mockFetchResolvedWith({ ok: false, json: () => Promise.resolve([]) });

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when fetch throws (network error)", async () => {
    mockFetchRejectedWith(new Error("network down"));

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });

  it("returns the fallback when the request times out", async () => {
    const timeoutError = new Error("The operation was aborted.");
    timeoutError.name = "TimeoutError";
    mockFetchRejectedWith(timeoutError);

    const result = await fetchWithFallback(ARRAY_FALLBACK, {
      baseUrl: "https://dev.career-data.example.dev",
      path: "/experience",
      parse: arrayParse,
      timeoutMs: 1,
    });

    expect(result).toBe(ARRAY_FALLBACK);
  });
});
