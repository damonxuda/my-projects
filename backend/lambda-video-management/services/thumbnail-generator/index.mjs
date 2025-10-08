import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { corsHeaders, createResponse, createErrorResponse, createSuccessResponse } from "./shared/s3-config.mjs";
import { generateThumbnail } from "./lib/thumbnail.mjs";
import { getBatchThumbnails } from "./lib/batch-thumbnails.mjs";


export const handler = async (event, context) => {
  console.log("=== Thumbnail Generator Lambda 开始执行 ===");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // 检查必要的环境变量
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("CLERK_SECRET_KEY未设置");
      return createErrorResponse(500, "Server configuration error", "Missing CLERK_SECRET_KEY");
    }

    if (!process.env.AWS_S3_VIDEO_BUCKET_NAME) {
      console.error("AWS_S3_VIDEO_BUCKET_NAME未设置");
      return createErrorResponse(500, "Server configuration error", "Missing AWS_S3_VIDEO_BUCKET_NAME");
    }

    // 自动触发场景（S3事件）- 优先检查，避免访问不存在的requestContext
    if (event.Records && event.Records[0] && event.Records[0].s3) {
      // S3事件触发的缩略图生成
      const s3Event = event.Records[0].s3;
      const videoKey = decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '));

      console.log("S3事件触发缩略图生成:", videoKey);

      // 只处理视频文件
      if (/\.(mp4|avi|mov|wmv|mkv)$/i.test(videoKey)) {
        return await generateThumbnail(videoKey);
      } else {
        console.log("非视频文件，跳过缩略图生成");
        return createSuccessResponse({ message: "Non-video file, skipped" });
      }
    }

    // 手动API调用场景
    // OPTIONS预检请求处理
    const method = event.requestContext?.http?.method;
    if (method === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // Token验证
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("缺少认证头或格式错误");
      return createErrorResponse(401, "Missing authorization");
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await verifyTokenAndCheckAccess(token);

    if (!user) {
      console.log("用户权限验证失败");
      return createErrorResponse(403, "Access denied");
    }

    console.log("用户验证成功:", user.emailAddresses?.[0]?.emailAddress);

    // 路由处理
    const path = event.requestContext.http.path || event.rawPath;
    console.log("处理路径:", path, "方法:", method);

    if (method === "POST" && path.startsWith("/thumbnails/generate/")) {
      const rawPath = event.rawPath || event.requestContext.http.path;
      const rawVideoKey = rawPath.replace("/thumbnails/generate/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await generateThumbnail(videoKey);
    } else if (method === "GET" && path === "/thumbnails/batch") {
      const pathParam = event.queryStringParameters?.path || "";
      return await getBatchThumbnails(pathParam, user);
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};