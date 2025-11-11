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

    if (!process.env.AWS_S3_VIDEO_BUCKET_NAME) {
      console.error("AWS_S3_VIDEO_BUCKET_NAME未设置");
      return createErrorResponse(500, "Server configuration error", "Missing AWS_S3_VIDEO_BUCKET_NAME");
    }

    // 自动触发场景（S3事件）- 优先检查以避免访问undefined的requestContext
    if (event.Records && event.Records[0] && event.Records[0].s3) {
      // S3事件触发的格式转换
      const s3Event = event.Records[0].s3;
      const videoKey = decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '));

      console.log("S3事件触发智能分析和转换:", videoKey);

      // 只处理视频文件，且不是已经转换过的移动版本
      // 支持所有7种视频格式: mp4, avi, mov, wmv, mkv, flv, webm
      if (/\.(mp4|avi|mov|wmv|mkv|flv|webm)$/i.test(videoKey) && !videoKey.includes('_mobile.')) {
        // 使用新的智能分析和自动转换逻辑，基于MOOV位置判断是否需要生成mobile版本
        return await analyzeAndAutoConvert(videoKey, true, null);
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

      // 如果转换完成，检查是否需要删除原文件
      if (status === "COMPLETE") {
        try {
          const userMetadata = jobDetail.userMetadata || {};
          const originalKey = userMetadata.originalKey;

          if (originalKey && originalKey.startsWith("videos/") && !originalKey.includes("_mobile.")) {
            const { HeadObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
            const { s3Client, VIDEO_BUCKET } = await import("./shared/s3-config.mjs");

            // 检查是否真的生成了 _mobile.mp4 版本
            const mobileKey = originalKey.replace(/\.(mp4|avi|mov|wmv|mkv|flv|webm)$/i, '_mobile.mp4');

            try {
              await s3Client.send(new HeadObjectCommand({
                Bucket: VIDEO_BUCKET,
                Key: mobileKey
              }));

              // _mobile.mp4 存在，说明确实生成了移动版本，可以删除原文件
              console.log(`🗑️ 检测到_mobile.mp4版本，准备删除原文件: ${originalKey}`);

              await s3Client.send(new DeleteObjectCommand({
                Bucket: VIDEO_BUCKET,
                Key: originalKey
              }));

              console.log(`✅ 原文件已删除: ${originalKey} (已生成${mobileKey})`);

              // 同时删除原文件的缩略图（如果存在）
              const relativePath = originalKey.replace('videos/', '');
              const originalThumbnailKey = `thumbnails/${relativePath.replace(/\.[^.]+$/, '.jpg')}`;

              try {
                await s3Client.send(new DeleteObjectCommand({
                  Bucket: VIDEO_BUCKET,
                  Key: originalThumbnailKey
                }));
                console.log(`✅ 原文件缩略图已删除: ${originalThumbnailKey}`);
              } catch (thumbError) {
                console.log(`⚠️ 原文件缩略图删除失败或不存在: ${originalThumbnailKey}`);
              }
            } catch (headError) {
              // _mobile.mp4 不存在，说明这次转换不是为了生成mobile版本
              // 可能只是优化MOOV位置或其他原因，保留原文件
              console.log(`ℹ️ 未检测到_mobile.mp4版本，保留原文件: ${originalKey}`);
              console.log(`   可能原因：仅优化MOOV位置或文件本身已兼容`);
            }
          }
        } catch (deleteError) {
          console.error(`❌ 处理转换完成事件失败:`, deleteError);
          // 不阻断主流程，只记录错误
        }
      }

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
    console.log("🔧 路由调试:");
    console.log("  event.requestContext?.http?.path:", event.requestContext?.http?.path);
    console.log("  event.rawPath:", event.rawPath);
    console.log("  最终使用的path:", path);
    console.log("  path长度:", path ? path.length : 'null');
    console.log("  方法:", method);

    // 检查路径字符
    if (path) {
      console.log("  路径字符分析:");
      for (let i = 0; i < Math.min(path.length, 50); i++) {
        const char = path[i];
        const code = char.charCodeAt(0);
        if (code !== 32 && (code < 33 || code > 126)) {
          console.log(`    位置${i}: "${char}" (ASCII: ${code}) ⚠️ 异常字符`);
        } else if (char === ' ') {
          console.log(`    位置${i}: 空格 (ASCII: 32) ⚠️`);
        }
      }
    }

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
    } else if (method === "POST" && (path.startsWith("/convert/auto-analyze/") || path.includes("auto-analyze"))) {
      console.log("🎯 匹配到auto-analyze路由");
      const rawPath = event.rawPath || event.requestContext?.http?.path;
      console.log("  rawPath:", rawPath);

      // 更鲁棒的路径解析，处理可能的编码问题
      let rawVideoKey = "";
      if (rawPath.startsWith("/convert/auto-analyze/")) {
        rawVideoKey = rawPath.replace("/convert/auto-analyze/", "");
      } else {
        // 备用解析方法，找到auto-analyze后面的部分
        const autoAnalyzeIndex = rawPath.indexOf("auto-analyze/");
        if (autoAnalyzeIndex !== -1) {
          rawVideoKey = rawPath.substring(autoAnalyzeIndex + "auto-analyze/".length);
        }
      }

      console.log("  提取的rawVideoKey:", rawVideoKey);
      const videoKey = decodeURIComponent(rawVideoKey);
      console.log("  解码后的videoKey:", videoKey);

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
    } else if (method === "POST" && path === "/test/path-debug") {
      // 临时调试端点
      const body = JSON.parse(event.body || '{}');
      const inputKey = body.inputKey || 'videos/贾老师初联一轮/第2讲 绝对值 例17.mp4';
      const outputPrefix = body.outputPrefix || 'videos';

      const inputDir = inputKey.substring(0, inputKey.lastIndexOf('/') + 1);
      const outputS3Prefix = `s3://${process.env.AWS_S3_VIDEO_BUCKET_NAME}/${inputDir}`;

      return createSuccessResponse({
        inputKey,
        outputPrefix,
        inputDir,
        outputS3Prefix,
        logic: outputPrefix === "videos" || !outputPrefix ? "same-directory" : "specified-prefix"
      });
    }

    console.log("路由不匹配");
    return createErrorResponse(404, "Not found");

  } catch (error) {
    console.error("Lambda执行失败:", error);
    return createErrorResponse(500, "Internal server error", error.message);
  }
};