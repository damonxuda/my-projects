import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { corsHeaders, createResponse, createErrorResponse, createSuccessResponse } from "./shared/s3-config.mjs";
import { listVideos } from "./lib/video-list.mjs";
import { generateUploadUrl } from "./lib/video-upload.mjs";
import { deleteVideo } from "./lib/video-delete.mjs";
import { renameItem, moveItem, copyItem, createFolder, batchRename } from "./lib/file-operations.mjs";

export const handler = async (event, context) => {
  console.log("=== File Management Lambda 开始执行 ===");
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

    // 获取HTTP方法 - 支持Function URL和直接调用
    const method = event.requestContext?.http?.method || event.httpMethod || "POST";

    // OPTIONS预检请求处理
    if (method === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // Token验证 - 支持Function URL和直接调用
    const headers = event.headers || {};
    const authHeader = headers.authorization || headers.Authorization;
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

    // 路由处理 - 支持Function URL和直接调用
    const path = event.requestContext?.http?.path || event.rawPath || event.path || "/";
    console.log("处理路径:", path, "方法:", method);

    if (method === "GET" && path === "/files/list") {
      // 获取路径参数
      const queryParams = event.queryStringParameters || {};
      const requestedPath = queryParams.path || "";
      console.log("文件列表请求路径参数:", requestedPath);
      return await listVideos(user, requestedPath);
    } else if (method === "POST" && path === "/files/upload-url") {
      // 生成预签名上传URL - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await generateUploadUrl(event, user);
    } else if (method === "DELETE" && path === "/files/delete") {
      // 只有管理员可以删除文件
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await deleteVideo(event, user);
    } else if (method === "POST" && path === "/files/rename") {
      // 重命名文件或文件夹 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await renameItem(event, user);
    } else if (method === "POST" && path === "/files/move") {
      // 移动文件或文件夹 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await moveItem(event, user);
    } else if (method === "POST" && path === "/files/copy") {
      // 复制文件或文件夹 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await copyItem(event, user);
    } else if (method === "POST" && path === "/files/create-folder") {
      // 创建文件夹 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await createFolder(event, user);
    } else if (method === "POST" && path === "/files/batch-rename") {
      // 批量重命名 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await batchRename(event, user);
    } else if (method === "DELETE" && path === "/files/batch-delete") {
      // 批量删除 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      // 解析请求体
      const { files } = JSON.parse(event.body);
      if (!files || !Array.isArray(files)) {
        return createErrorResponse(400, "缺少文件列表参数");
      }

      console.log(`📦 批量删除 ${files.length} 个文件`);
      const results = [];

      for (const filePath of files) {
        try {
          // 调用单个删除函数
          const deleteResult = await deleteVideo({
            body: JSON.stringify({ key: filePath })
          }, user);

          results.push({
            file: filePath,
            success: deleteResult.statusCode === 200,
            error: deleteResult.statusCode !== 200 ? JSON.parse(deleteResult.body).message : null
          });
        } catch (error) {
          results.push({
            file: filePath,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      return createSuccessResponse({
        success: true,
        message: `批量删除完成: 成功 ${successCount} 个，失败 ${failedCount} 个`,
        results: results
      });
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};