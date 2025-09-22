import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { corsHeaders, createResponse, createErrorResponse, createSuccessResponse } from "./shared/s3-config.mjs";
import { listDownloadHistory } from "./lib/download-history.mjs";
// import { downloadYouTubeVideo } from "./lib/youtube-downloader.mjs";
// import { getVideoInfo } from "./lib/youtube-info.mjs";

export const handler = async (event, context) => {
  console.log("=== YouTube Manager Lambda 开始执行 ===");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // 检查必要的环境变量
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("CLERK_SECRET_KEY未设置");
      return createErrorResponse(500, "Server configuration error", "Missing CLERK_SECRET_KEY");
    }

    if (!process.env.VIDEO_BUCKET_NAME) {
      console.error("VIDEO_BUCKET_NAME未设置");
      return createErrorResponse(500, "Server configuration error", "Missing VIDEO_BUCKET_NAME");
    }

    // OPTIONS预检请求处理
    const method = event.requestContext.http.method;
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

    // 只有管理员可以使用YouTube功能
    if (!isAdmin(user)) {
      return createErrorResponse(403, "Admin access required for YouTube management");
    }

    // 路由处理
    const path = event.requestContext.http.path || event.rawPath;
    console.log("处理路径:", path, "方法:", method);

    if (method === "POST" && path === "/youtube/download") {
      // 下载YouTube视频 - 暂时禁用
      return createErrorResponse(501, "Not Implemented", "YouTube download feature temporarily disabled");
    } else if (method === "GET" && path === "/youtube/info") {
      // 获取YouTube视频信息 - 暂时禁用
      return createErrorResponse(501, "Not Implemented", "YouTube info feature temporarily disabled");
    } else if (method === "GET" && path === "/youtube/history") {
      // 列出下载历史
      return await listDownloadHistory(event, user);
    } else if (method === "DELETE" && path === "/youtube/delete") {
      // 删除YouTube文件 - 使用通用删除逻辑
      const { key } = JSON.parse(event.body);

      if (!key || !key.endsWith('.youtube.json')) {
        return createErrorResponse(400, "Invalid YouTube file path");
      }

      // 使用文件管理函数的删除逻辑
      const deleteEvent = {
        body: JSON.stringify({ key })
      };

      // 这里可以直接调用S3删除操作
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const { s3Client, VIDEO_BUCKET } = await import("./shared/s3-config.mjs");

      await s3Client.send(new DeleteObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: key,
      }));

      return createSuccessResponse({
        message: "YouTube file deleted successfully",
        deletedKey: key
      });
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};