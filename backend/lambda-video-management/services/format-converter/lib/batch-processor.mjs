import { ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { processVideo } from "./video-converter.mjs";
import { getUserAccessibleFolders } from "../shared/auth.mjs";

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
      maxConcurrency = 3,
      dryRun = false,
      maxFiles = 50
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

      // 确保路径格式正确 - 如果没有videos/前缀则添加
      let normalizedPath = folderPath;
      if (!normalizedPath.startsWith("videos/")) {
        normalizedPath = "videos/" + normalizedPath;
      }
      const scanPath = normalizedPath.endsWith("/") ? normalizedPath : normalizedPath + "/";

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
    if (targetFiles.length > maxFiles) {
      targetFiles = targetFiles.slice(0, maxFiles);
      console.log(`Limited to ${maxFiles} files for processing`);
    }

    // 如果是扫描模式，检查哪些文件需要转换
    if (dryRun) {
      console.log("=== 扫描模式：检查文件编码状态 ===");
      return await scanVideoFiles(targetFiles, folderPath);
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

// 扫描视频文件，检查哪些需要转换
async function scanVideoFiles(targetFiles, folderPath) {
  console.log(`Scanning ${targetFiles.length} video files for conversion needs`);

  const needsConversion = [];
  const hasConversion = [];
  const errors = [];

  for (const originalKey of targetFiles) {
    try {
      console.log(`Checking: ${originalKey}`);

      // 获取原始文件信息
      const headCommand = new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: originalKey
      });

      const headResponse = await s3Client.send(headCommand);
      const fileSize = headResponse.ContentLength;
      const lastModified = headResponse.LastModified;

      // 检查是否已经有转换版本 - 检查多个可能的位置
      const fileName = getFileNameWithoutExtension(originalKey);
      const originalDir = originalKey.substring(0, originalKey.lastIndexOf('/') + 1);

      // 可能的mobile版本位置
      const possibleMobileKeys = [
        `${originalDir}${fileName}_mobile.mp4`,  // 同目录下
        `processed/${fileName}_mobile.mp4`,      // processed目录下
        `${originalKey.replace('.mp4', '_mobile.mp4')}` // 直接替换扩展名
      ];

      let hasExistingConversion = false;
      let foundMobileKey = null;

      for (const mobileKey of possibleMobileKeys) {
        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: VIDEO_BUCKET,
            Key: mobileKey
          }));
          hasExistingConversion = true;
          foundMobileKey = mobileKey;
          console.log(`✅ Found existing conversion: ${mobileKey}`);
          break;
        } catch (error) {
          if (error.name !== "NotFound") {
            console.error(`Error checking conversion ${mobileKey}:`, error.message);
          }
        }
      }

      const videoInfo = {
        originalKey,
        size: fileSize,
        lastModified,
        fileName: originalKey.split('/').pop()
      };

      if (hasExistingConversion) {
        hasConversion.push({
          ...videoInfo,
          convertedKey: foundMobileKey,
          status: "已转换"
        });
      } else {
        // 改进的判断逻辑：更低的文件大小阈值，或其他启发式条件
        const needsConversionCheck =
          fileSize > 10 * 1024 * 1024 || // 大于10MB（降低阈值）
          !originalKey.toLowerCase().endsWith('.mp4') || // 非MP4格式
          originalKey.includes('原始') || // 包含"原始"关键字
          originalKey.includes('raw') || // 包含"raw"关键字
          originalKey.includes('第') || // 包含"第"字（可能是课程视频）
          originalKey.includes('讲'); // 包含"讲"字（可能是教学视频）

        if (needsConversionCheck) {
          let reason = "格式需要优化";
          if (fileSize > 50 * 1024 * 1024) {
            reason = "文件过大";
          } else if (fileSize > 10 * 1024 * 1024) {
            reason = "文件较大，建议压缩";
          } else if (!originalKey.toLowerCase().endsWith('.mp4')) {
            reason = "非MP4格式";
          }

          needsConversion.push({
            ...videoInfo,
            reason: reason
          });
        } else {
          hasConversion.push({
            ...videoInfo,
            status: "无需转换"
          });
        }
      }

    } catch (error) {
      console.error(`Error scanning ${originalKey}:`, error.message);
      errors.push({
        originalKey,
        error: error.message
      });
    }
  }

  const scanResults = {
    success: true,
    scanPath: folderPath || "指定文件",
    summary: {
      totalScanned: targetFiles.length,
      needsConversion: needsConversion.length,
      hasConversion: hasConversion.length,
      errors: errors.length
    },
    needsConversion,
    hasConversion,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  };

  console.log("Scan results:", scanResults.summary);
  return createSuccessResponse(scanResults);
}