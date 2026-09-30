/** fetch wrapper for our API routes: returns { data } or { error } (api-spec.md §10). */
export async function callApi<T = unknown>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: string }> {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error ?? "Something went wrong" };
    return { data: json as T };
  } catch {
    return { error: "Network error — please try again." };
  }
}
