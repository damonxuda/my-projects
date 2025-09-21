import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../../shared/s3-config.mjs";
import { processVideo } from "./video-converter.mjs";
import { getUserAccessibleFolders } from "../../shared/auth.mjs";

export async function batchProcessVideos(event, user) {
  try {
    console.log("=== 批量视频处理 ===");

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const {
      folderPath,
      fileKeys = [],
      settings = {},
      maxConcurrency = 3
    } = body;

    console.log("Batch processing request:", { folderPath, fileKeysCount: fileKeys.length, maxConcurrency });

    let targetFiles = [];

    // 如果提供了具体的文件键列表
    if (fileKeys && fileKeys.length > 0) {
      targetFiles = fileKeys.filter(key => {
        // 验证文件路径安全性
        if (!key.startsWith("videos/")) {
          console.warn("Skipping invalid file path:", key);
          return false;
        }
        // 只处理视频文件
        return isVideoFile(key);
      });

      console.log("Processing specific files:", targetFiles.length);
    }
    // 如果提供了文件夹路径，扫描整个文件夹
    else if (folderPath) {
      // 验证用户对该文件夹的访问权限
      const userFolders = await getUserAccessibleFolders(user);
      const targetFolder = folderPath.replace("videos/", "");

      if (targetFolder && !userFolders.includes(targetFolder)) {
        return createErrorResponse(403, "Access denied", "您没有访问该文件夹的权限");
      }

      // 确保路径格式正确
      const scanPath = folderPath.endsWith("/") ? folderPath : folderPath + "/";
      if (!scanPath.startsWith("videos/")) {
        return createErrorResponse(400, "Invalid folder path", "文件夹路径必须在videos/目录下");
      }

      console.log("Scanning folder:", scanPath);

      // 扫描文件夹中的视频文件
      const listCommand = new ListObjectsV2Command({
        Bucket: VIDEO_BUCKET,
        Prefix: scanPath,
        MaxKeys: 1000
      });

      const listResponse = await s3Client.send(listCommand);

      targetFiles = (listResponse.Contents || [])
        .map(obj => obj.Key)
        .filter(key => {
          // 跳过文件夹标记
          if (key.endsWith("/")) return false;
          // 只处理视频文件
          return isVideoFile(key);
        });

      console.log("Found video files in folder:", targetFiles.length);
    } else {
      return createErrorResponse(400, "Missing parameters", "必须提供fileKeys或folderPath参数");
    }

    if (targetFiles.length === 0) {
      return createErrorResponse(400, "No files to process", "没有找到需要处理的视频文件");
    }

    // 限制最大处理数量以避免资源过载
    const maxBatchSize = 50;
    if (targetFiles.length > maxBatchSize) {
      return createErrorResponse(400, "Batch size too large", `最多同时处理${maxBatchSize}个文件`);
    }

    console.log(`Starting batch processing of ${targetFiles.length} files`);

    // 批量处理设置
    const batchSettings = {
      quality: "standard",
      format: "mp4",
      resolution: "720p",
      enableMobile: true,
      ...settings
    };

    // 并发控制 - 分批处理
    const results = [];
    const errors = [];

    for (let i = 0; i < targetFiles.length; i += maxConcurrency) {
      const batch = targetFiles.slice(i, i + maxConcurrency);
      console.log(`Processing batch ${Math.floor(i / maxConcurrency) + 1}: ${batch.length} files`);

      // 并发处理当前批次
      const batchPromises = batch.map(async (fileKey) => {
        try {
          // 为每个文件创建处理事件
          const processEvent = {
            body: JSON.stringify({
              inputKey: fileKey,
              outputPrefix: `processed/${getFileNameWithoutExtension(fileKey)}`,
              settings: batchSettings
            }),
            headers: event.headers,
            requestContext: event.requestContext
          };

          const result = await processVideo(processEvent, user);

          if (result.statusCode === 200) {
            const data = JSON.parse(result.body);
            return {
              success: true,
              fileKey,
              jobId: data.jobId,
              message: "Processing started successfully"
            };
          } else {
            const errorData = JSON.parse(result.body);
            throw new Error(errorData.message || "Processing failed");
          }
        } catch (error) {
          console.error(`Failed to process ${fileKey}:`, error);
          return {
            success: false,
            fileKey,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // 分类结果
      batchResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });

      // 在批次之间添加小延迟，避免对服务造成过大压力
      if (i + maxConcurrency < targetFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Batch processing completed: ${results.length} success, ${errors.length} errors`);

    const response = {
      success: true,
      batchId: `batch_${Date.now()}_${user.id}`,
      totalFiles: targetFiles.length,
      successCount: results.length,
      errorCount: errors.length,
      settings: batchSettings,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
      estimatedCompletionTime: `${Math.ceil(targetFiles.length * 8 / maxConcurrency)} minutes`,
      message: `已启动${results.length}个处理作业，${errors.length}个文件处理失败`
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error("批量处理失败:", error);
    return createErrorResponse(500, "Batch processing failed", error.message);
  }
}

function isVideoFile(fileName) {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  return videoExtensions.includes(ext);
}

function getFileNameWithoutExtension(filePath) {
  const fileName = filePath.split('/').pop();
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
}