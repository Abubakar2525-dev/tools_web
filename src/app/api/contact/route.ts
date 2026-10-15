/**
 * Same-origin adapter for the Python API.
 *
 * The browser continues to post to /api/contact, so the UI contract and CORS
 * behavior stay unchanged. Validation, rate limiting and delivery live in the
 * FastAPI service under backend/.
 */

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 15_000;

export async function POST(request: Request) {
  const apiUrl = (process.env.PYTHON_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl}/contact`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") || "application/json",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "unknown",
        "user-agent": request.headers.get("user-agent") || "Backendz Next.js proxy",
      },
      body: await request.text(),
      cache: "no-store",
      signal: controller.signal,
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("[contact] Python API unavailable", error instanceof Error ? error.message : String(error));
    return Response.json(
      {
        ok: false,
        code: "api_unavailable",
        message: "We could not deliver your message just now. Please try again shortly.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
