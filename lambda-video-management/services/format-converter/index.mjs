import { verifyTokenAndCheckAccess, isAdmin } from "./shared/auth.mjs";
import { corsHeaders, createResponse, createErrorResponse, createSuccessResponse } from "./shared/s3-config.mjs";
import { processVideo } from "./lib/video-converter.mjs";
import { checkJobStatus } from "./lib/job-status.mjs";
import { batchProcessVideos } from "./lib/batch-processor.mjs";
import { analyzeVideoCompatibility, analyzeAndAutoConvert } from "./lib/video-analyzer.mjs";

export const handler = async (event, context) => {
  console.log("=== Format Converter Lambda 开始执行 ===");
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

    // 自动触发场景（S3事件）- 优先检查以避免访问undefined的requestContext
    if (event.Records && event.Records[0] && event.Records[0].s3) {
      // S3事件触发的格式转换
      const s3Event = event.Records[0].s3;
      const videoKey = decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '));

      console.log("S3事件触发格式转换:", videoKey);

      // 只处理视频文件，且不是已经转换过的移动版本
      if (/\.(mp4|avi|mov|wmv|mkv)$/i.test(videoKey) && !videoKey.includes('_mobile.')) {
        return await processVideo(videoKey);
      } else {
        console.log("跳过格式转换:", videoKey);
        return createSuccessResponse({ message: "Video conversion skipped" });
      }
    }

    // OPTIONS预检请求处理 - 仅对HTTP请求
    const method = event.requestContext?.http?.method;
    if (method === "OPTIONS") {
      return createResponse(200, { message: "CORS preflight" });
    }

    // MediaConvert状态回调
    if (event.source === "aws.mediaconvert") {
      console.log("MediaConvert状态回调:", event.detail);

      const jobDetail = event.detail;
      const jobId = jobDetail.jobId;
      const status = jobDetail.status;

      console.log(`MediaConvert作业 ${jobId} 状态: ${status}`);

      // 可以在这里添加状态更新逻辑，比如更新数据库或发送通知
      return createSuccessResponse({
        message: "MediaConvert status processed",
        jobId: jobId,
        status: status
      });
    }

    // 手动API调用场景
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
    const path = event.requestContext?.http?.path || event.rawPath;
    console.log("处理路径:", path, "方法:", method);

    if (method === "POST" && path.startsWith("/convert/process/")) {
      const rawPath = event.rawPath || event.requestContext?.http?.path;
      const rawVideoKey = rawPath.replace("/convert/process/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await processVideo(event, user);
    } else if (method === "GET" && path.startsWith("/convert/status/")) {
      const rawPath = event.rawPath || event.requestContext?.http?.path;
      const jobId = rawPath.replace("/convert/status/", "");
      return await checkJobStatus(jobId);
    } else if (method === "GET" && path.startsWith("/convert/analyze/")) {
      const rawPath = event.rawPath || event.requestContext?.http?.path;
      const rawVideoKey = rawPath.replace("/convert/analyze/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await analyzeVideoCompatibility(videoKey);
    } else if (method === "POST" && path.startsWith("/convert/auto-analyze/")) {
      const rawPath = event.rawPath || event.requestContext?.http?.path;
      const rawVideoKey = rawPath.replace("/convert/auto-analyze/", "");
      const videoKey = decodeURIComponent(rawVideoKey);

      // 从请求体中获取autoConvert参数
      let autoConvert = true; // 默认启用自动转换
      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          if (body.autoConvert !== undefined) {
            autoConvert = body.autoConvert;
          }
        } catch (e) {
          // 如果解析失败，使用默认值
        }
      }

      return await analyzeAndAutoConvert(videoKey, autoConvert, user);
    } else if (method === "POST" && path === "/convert/batch") {
      // 批量处理 - 仅管理员
      if (!isAdmin(user)) {
        return createErrorResponse(403, "Admin access required");
      }
      return await batchProcessVideos(event, user);
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};