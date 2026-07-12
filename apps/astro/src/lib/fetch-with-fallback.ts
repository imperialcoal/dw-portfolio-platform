// Extracted from the near-identical inline pattern in About.astro,
// Skills.astro, Experience.astro, and Project.astro. Three of the four
// (Skills, Experience, Project) fetch an endpoint that returns an array
// directly; About fetches /profile, which returns a nested { bio?: Bio }
// object. A hardcoded "is this a non-empty array" check can't cover both
// shapes, so the caller supplies its own `parse` function instead — this
// module owns only the shared concerns: missing baseUrl, non-2xx, network
// errors, and timeouts.
//
// Pulled into a standalone module so it's testable with plain vitest — no
// Astro-specific test tooling required, matching the "pure logic, no infra"
// unit-test class already used by @dw/auth and @dw/contracts.
//
// Deliberately takes `baseUrl` as a parameter rather than reading
// `import.meta.env.CAREER_DATA_URL` internally — keeps this module
// framework-agnostic and directly importable by vitest. Each .astro
// component passes its own `import.meta.env.CAREER_DATA_URL` at the call
// site, exactly as it does today.

export interface FetchWithFallbackOptions<T> {
  /** career-data base URL, e.g. import.meta.env.CAREER_DATA_URL */
  baseUrl: string | undefined;
  /** path appended to baseUrl, e.g. "/experience" */
  path: string;
  /** milliseconds before the request is aborted */
  timeoutMs?: number;
  /**
   * Validates and/or extracts the desired value from the parsed JSON body.
   * Return the value to use, or null/undefined to fall back.
   *
   * Array endpoints (Skills, Experience, Project):
   *   parse: (json) => Array.isArray(json) && json.length > 0 ? json as T : undefined
   *
   * Nested single-object endpoints (About's /profile → { bio }):
   *   parse: (json) => (json as { bio?: Bio }).bio
   */
  parse: (json: unknown) => T | null | undefined;
}

/**
 * Fetches from career-data with a graceful fallback for local dev
 * (baseUrl unset), non-2xx responses, network errors, timeouts, and
 * whatever `parse` considers an invalid/absent payload.
 *
 * Mirrors the exact fallback conditions already used inline in every
 * Astro component that calls career-data: unset URL, !res.ok, thrown
 * error, or a parsed body that doesn't satisfy `parse`.
 */
export async function fetchWithFallback<T>(
  fallback: T,
  { baseUrl, path, timeoutMs = 5000, parse }: FetchWithFallbackOptions<T>,
): Promise<T> {
  if (!baseUrl) return fallback;

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return fallback;

    const json: unknown = await res.json();
    const parsed = parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
