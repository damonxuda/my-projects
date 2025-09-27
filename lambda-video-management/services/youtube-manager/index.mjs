import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { corsHeaders, createResponse, createErrorResponse, createSuccessResponse } from "./shared/s3-config.mjs";
import { listYouTubeFiles } from "./lib/youtube-list.mjs";
import { addYouTubeFile } from "./lib/youtube-add.mjs";
import { deleteYouTubeFile } from "./lib/youtube-delete.mjs";

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

    // YouTube管理功能对所有已验证用户开放
    console.log("YouTube功能访问权限检查通过");

    // 路由处理
    const path = event.requestContext.http.path || event.rawPath;
    console.log("处理路径:", path, "方法:", method);

    if (method === "GET" && path === "/youtube/list") {
      // 列出YouTube文件
      return await listYouTubeFiles(event, user);
    } else if (method === "POST" && path === "/youtube/add") {
      // 添加YouTube文件
      return await addYouTubeFile(event, user);
    } else if (method === "DELETE" && path === "/youtube/delete") {
      // 删除YouTube文件
      return await deleteYouTubeFile(event, user);
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};