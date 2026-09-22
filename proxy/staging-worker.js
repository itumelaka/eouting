import authoritativeStagingWorker, { reconcileMirrorRetryQueue } from "./staging-worker-base.js";
import { handleStudentCancellation } from "./staging-student-cancellation.js";

function errorResponse(error, requestId, headers) {
  const known = error && error.code && Number.isInteger(error.status);
  return new Response(JSON.stringify({
    ok: false,
    error: known ? error.message : "Staging D1 request failed",
    code: known ? error.code : "D1_REQUEST_FAILED",
    request_id: requestId,
    outcome_unknown: false
  }), { status: known ? error.status : 500, headers });
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/d1/cancelStudentRequest") {
      return authoritativeStagingWorker.fetch(request, env, context);
    }

    const started = Date.now();
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("Origin");
    const localOrigin = env.STAGING_ORIGIN;
    const allowedOrigin = origin === "https://itumelaka.github.io" ||
      (["http://localhost:8000", "http://127.0.0.1:8000"].includes(localOrigin) && origin === localOrigin);
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
      "X-Request-ID": requestId,
      "X-Upstream-Attempts": "0"
    });
    if (allowedOrigin) headers.set("Access-Control-Allow-Origin", origin);

    let status = 500;
    try {
      if (!allowedOrigin) {
        throw Object.assign(new Error("Origin not allowed"), { status: 403, code: "ORIGIN_NOT_ALLOWED" });
      }
      const response = await handleStudentCancellation(request, env, headers, { context });
      status = response.status;
      return response;
    } catch (error) {
      const response = errorResponse(error, requestId, headers);
      status = response.status;
      return response;
    } finally {
      console.info(JSON.stringify({
        request_id: requestId,
        action: "cancelStudentRequest",
        method: request.method,
        status,
        duration_ms: Date.now() - started
      }));
    }
  },

  async scheduled(controller, env, context) {
    const task = reconcileMirrorRetryQueue(env)
      .then((result) => {
        console.info(JSON.stringify({
          event: "OUTING_REQUEST_MIRROR_RECONCILIATION_COMPLETED",
          cron: controller.cron,
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed
        }));
      })
      .catch((error) => {
        console.error(JSON.stringify({
          event: "OUTING_REQUEST_MIRROR_RECONCILIATION_FAILED",
          cron: controller.cron,
          error: String(error && error.message || error)
        }));
      });

    context.waitUntil(task);
  }
};
