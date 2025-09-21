import { verifyTokenAndCheckAccess } from "../shared/auth.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { processVideo } from "./lib/video-converter.mjs";
import { checkJobStatus } from "./lib/job-status.mjs";
import { batchProcessVideos } from "./lib/batch-processor.mjs";

export async function handler(event) {
  console.log("=== Video Processing Lambda ===");
  console.log("Method:", event.httpMethod || event.requestContext?.http?.method);
  console.log("Path:", event.path || event.rawPath);

  try {
    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath || "";

    // CORS preflight
    if (method === "OPTIONS") {
      return createSuccessResponse({ message: "CORS preflight" });
    }

    // Extract path parts
    const pathParts = path.split("/").filter(part => part);
    console.log("Path parts:", pathParts);

    // Authentication check for all endpoints
    const authResult = await verifyTokenAndCheckAccess(event);
    if (!authResult.success) {
      return createErrorResponse(401, "Unauthorized", authResult.error);
    }

    const user = authResult.user;
    console.log("Authenticated user:", user.id);

    // Route handling
    if (method === "POST" && pathParts.length >= 2) {
      const [action, subAction] = pathParts;

      if (action === "process") {
        if (subAction === "video") {
          // POST /process/video - Start video processing
          return await processVideo(event, user);
        } else if (subAction === "batch") {
          // POST /process/batch - Batch process multiple videos
          return await batchProcessVideos(event, user);
        }
      }
    }

    if (method === "GET" && pathParts.length >= 2) {
      const [action, subAction] = pathParts;

      if (action === "job" && subAction === "status") {
        // GET /job/status?jobId=xxx - Check processing job status
        return await checkJobStatus(event, user);
      }
    }

    // Route not found
    return createErrorResponse(404, "Not Found", `Route ${method} ${path} not found`);

  } catch (error) {
    console.error("Handler error:", error);
    return createErrorResponse(500, "Internal Server Error", error.message);
  }
}