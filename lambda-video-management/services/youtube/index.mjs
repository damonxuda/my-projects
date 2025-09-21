import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { createSuccessResponse, createErrorResponse } from "./shared/s3-config.mjs";
// import { downloadYouTubeVideo } from "./lib/youtube-downloader.mjs";
// import { getVideoInfo } from "./lib/youtube-info.mjs";
import { listDownloadHistory } from "./lib/download-history.mjs";

export async function handler(event) {
  console.log("=== YouTube Lambda ===");
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

    // Admin-only check for certain operations
    const userIsAdmin = await isAdmin(user);

    // Route handling
    if (method === "POST" && pathParts.length >= 1) {
      if (pathParts[0] === "download") {
        // POST /download - Download YouTube video
        if (!userIsAdmin) {
          return createErrorResponse(403, "Forbidden", "Only administrators can download YouTube videos");
        }
        return createErrorResponse(501, "Not Implemented", "YouTube download feature temporarily disabled");
      }
    }

    if (method === "GET" && pathParts.length >= 1) {
      if (pathParts[0] === "info") {
        // GET /info?url=... - Get video information
        return createErrorResponse(501, "Not Implemented", "YouTube info feature temporarily disabled");
      } else if (pathParts[0] === "history") {
        // GET /history - List download history
        if (!userIsAdmin) {
          return createErrorResponse(403, "Forbidden", "Only administrators can view download history");
        }
        return await listDownloadHistory(event, user);
      }
    }

    // Route not found
    return createErrorResponse(404, "Not Found", `Route ${method} ${path} not found`);

  } catch (error) {
    console.error("Handler error:", error);
    return createErrorResponse(500, "Internal Server Error", error.message);
  }
}