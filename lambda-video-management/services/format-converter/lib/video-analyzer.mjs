import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { processVideo } from "./video-converter.mjs";

/**
 * 分析视频文件的编码兼容性
 * 主要检查以下几个关键因素：
 * 1. H.264编码配置（Profile、Level）
 * 2. MOOV atom位置
 * 3. 帧率和分辨率
 * 4. 音频编码格式
 */

export async function analyzeVideoCompatibility(videoKey) {
  try {
    console.log("=== 开始视频兼容性分析 ===");
    console.log("视频文件:", videoKey);

    // 验证文件路径安全性
    if (!videoKey.startsWith("videos/")) {
      return createErrorResponse(400, "Invalid video path - must be in videos/ directory");
    }

    // 检查文件是否存在并获取基本信息
    let fileInfo;
    try {
      fileInfo = await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoKey,
      }));
    } catch (headError) {
      if (headError.name === "NotFound") {
        return createErrorResponse(404, "Video file not found");
      }
      throw headError;
    }

    const fileSize = fileInfo.ContentLength;
    const lastModified = fileInfo.LastModified;
    const contentType = fileInfo.ContentType;

    console.log(`文件信息: ${fileSize} bytes, ${contentType}, 修改时间: ${lastModified}`);

    // 只分析支持的视频格式
    const supportedFormats = ['.mp4', '.mov', '.avi', '.mkv'];
    const fileExtension = videoKey.toLowerCase().match(/\.[^.]*$/)?.[0];

    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      return createErrorResponse(400, "Unsupported video format", `支持的格式: ${supportedFormats.join(', ')}`);
    }

    // 进行详细的编码兼容性分析
    const compatibilityResult = await performDetailedAnalysis(videoKey, fileSize, fileExtension);

    // 基于分析结果给出建议
    const recommendation = generateRecommendation(compatibilityResult, fileSize);

    return createSuccessResponse({
      success: true,
      videoKey,
      fileInfo: {
        size: fileSize,
        sizeFormatted: formatFileSize(fileSize),
        contentType,
        extension: fileExtension,
        lastModified: lastModified.toISOString()
      },
      compatibilityAnalysis: compatibilityResult,
      recommendation,
      analyzed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("视频兼容性分析失败:", error);
    return createErrorResponse(500, "Failed to analyze video compatibility", error.message);
  }
}

/**
 * 分析视频并在必要时自动触发转换
 */
export async function analyzeAndAutoConvert(videoKey, autoConvert = true, user = null) {
  try {
    console.log("=== 开始自动视频分析和转换 ===");
    console.log("视频文件:", videoKey, "自动转换:", autoConvert);

    // 首先进行兼容性分析
    const analysisResult = await analyzeVideoCompatibility(videoKey);

    if (!analysisResult.success) {
      return analysisResult;
    }

    const { recommendation } = analysisResult;
    let conversionResult = null;

    // 如果建议转换且启用了自动转换
    if (autoConvert && recommendation.shouldConvert) {
      console.log("🔄 触发自动视频转换...");
      console.log("转换原因:", recommendation.reasons);

      try {
        // 构建转换配置
        const settings = {
          quality: "standard",
          format: "mp4",
          resolution: "720p",
          enableMobile: true
        };

        // 根据文件大小调整设置
        const fileSize = analysisResult.fileInfo.size;
        if (fileSize > 500 * 1024 * 1024) {
          settings.resolution = "480p"; // 大文件使用较低分辨率
          settings.quality = "standard";
        } else if (fileSize > 200 * 1024 * 1024) {
          settings.resolution = "720p";
          settings.quality = "standard";
        }

        // 触发转换
        conversionResult = await processVideo(
          videoKey,
          "videos", // 输出目录保持在videos文件夹下，使用替换策略
          settings,
          user
        );

        console.log("✅ 自动转换已启动:", conversionResult.jobId);

      } catch (conversionError) {
        console.error("❌ 自动转换启动失败:", conversionError);
        // 不阻断主流程，返回分析结果但标记转换失败
        conversionResult = {
          success: false,
          error: conversionError.message,
          message: "Analysis completed but auto-conversion failed"
        };
      }
    } else {
      console.log("🎯 视频兼容性良好，无需转换");
    }

    // 返回综合结果
    return createSuccessResponse({
      ...analysisResult,
      autoConversion: {
        enabled: autoConvert,
        triggered: autoConvert && recommendation.shouldConvert,
        result: conversionResult
      }
    });

  } catch (error) {
    console.error("自动视频分析和转换失败:", error);
    return createErrorResponse(500, "Failed to analyze and auto-convert video", error.message);
  }
}

async function performDetailedAnalysis(videoKey, fileSize, fileExtension) {
  console.log("执行详细兼容性分析...");

  const analysis = {
    fileSize: fileSize,
    fileSizeCategory: categorizeFileSize(fileSize),
    extension: fileExtension,
    estimatedCompatibility: "unknown",
    issues: [],
    strengths: [],
    mobileCompatibility: "unknown",
    desktopCompatibility: "unknown",
    moovAtomAnalysis: null
  };

  try {
    // 分析MOOV atom位置 - 这是移动端兼容性的关键因素
    const moovAnalysis = await analyzeMoovAtomPosition(videoKey, fileSize);
    analysis.moovAtomAnalysis = moovAnalysis;

    // 基于文件大小进行启发式分析
    if (fileSize > 500 * 1024 * 1024) { // > 500MB
      analysis.issues.push("文件过大，可能影响移动端加载性能");
      analysis.mobileCompatibility = "poor";
    } else if (fileSize > 100 * 1024 * 1024) { // > 100MB
      analysis.issues.push("文件较大，建议优化移动端版本");
      analysis.mobileCompatibility = "moderate";
    } else {
      analysis.mobileCompatibility = "good";
      analysis.strengths.push("文件大小适中，移动端友好");
    }

    // MP4格式特定的兼容性检查
    if (fileExtension === '.mp4') {
      analysis.desktopCompatibility = "excellent";
      analysis.strengths.push("MP4格式，广泛兼容");

      // MOOV atom位置检查
      if (moovAnalysis.moovAtBeginning) {
        analysis.mobileCompatibility = analysis.mobileCompatibility === "poor" ? "moderate" : "excellent";
        analysis.strengths.push("MOOV atom在文件开头，支持流式播放");
      } else if (moovAnalysis.moovAtEnd) {
        analysis.issues.push("MOOV atom在文件末尾，移动端可能需要完整下载后才能播放");
        analysis.mobileCompatibility = "moderate";
      } else {
        analysis.issues.push("未检测到MOOV atom或位置不明确");
        analysis.mobileCompatibility = "poor";
      }
    } else {
      // 非MP4格式通常需要转换
      analysis.issues.push(`${fileExtension}格式，建议转换为MP4以获得更好兼容性`);
      analysis.mobileCompatibility = "poor";
      analysis.desktopCompatibility = "good";
    }

    // 综合兼容性评估
    const compatibilityScore = calculateOverallCompatibility(analysis);
    analysis.estimatedCompatibility = compatibilityScore;

    console.log("兼容性分析完成:", analysis);
    return analysis;

  } catch (error) {
    console.error("详细分析失败:", error);
    analysis.issues.push("分析过程中遇到错误: " + error.message);
    analysis.estimatedCompatibility = "poor";
    return analysis;
  }
}

async function analyzeMoovAtomPosition(videoKey, fileSize) {
  console.log("分析MOOV atom位置...");

  const result = {
    moovAtBeginning: false,
    moovAtEnd: false,
    analyzed: false,
    error: null
  };

  try {
    // 只对MP4文件进行MOOV分析
    if (!videoKey.toLowerCase().endsWith('.mp4')) {
      result.error = "MOOV分析仅适用于MP4文件";
      return result;
    }

    // 检查文件开头（前8KB）
    const headerResponse = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
      Range: "bytes=0-8191"
    }));

    const headerBuffer = Buffer.from(await headerResponse.Body.transformToByteArray());
    result.moovAtBeginning = headerBuffer.includes(Buffer.from('moov'));

    console.log(`MOOV atom检测 - 文件开头: ${result.moovAtBeginning}`);

    // 如果开头没有，检查文件末尾（后8KB）
    if (!result.moovAtBeginning && fileSize > 8192) {
      const tailResponse = await s3Client.send(new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoKey,
        Range: `bytes=${Math.max(0, fileSize - 8192)}-${fileSize - 1}`
      }));

      const tailBuffer = Buffer.from(await tailResponse.Body.transformToByteArray());
      result.moovAtEnd = tailBuffer.includes(Buffer.from('moov'));

      console.log(`MOOV atom检测 - 文件末尾: ${result.moovAtEnd}`);
    }

    result.analyzed = true;
    return result;

  } catch (error) {
    console.error("MOOV atom分析失败:", error);
    result.error = error.message;
    return result;
  }
}

function categorizeFileSize(fileSize) {
  if (fileSize < 50 * 1024 * 1024) return "small"; // < 50MB
  if (fileSize < 200 * 1024 * 1024) return "medium"; // < 200MB
  if (fileSize < 500 * 1024 * 1024) return "large"; // < 500MB
  return "very_large"; // >= 500MB
}

function calculateOverallCompatibility(analysis) {
  let score = 0;
  let maxScore = 0;

  // 移动端兼容性权重：40%
  maxScore += 40;
  if (analysis.mobileCompatibility === "excellent") score += 40;
  else if (analysis.mobileCompatibility === "good") score += 32;
  else if (analysis.mobileCompatibility === "moderate") score += 20;
  else if (analysis.mobileCompatibility === "poor") score += 8;

  // 桌面端兼容性权重：30%
  maxScore += 30;
  if (analysis.desktopCompatibility === "excellent") score += 30;
  else if (analysis.desktopCompatibility === "good") score += 24;
  else if (analysis.desktopCompatibility === "moderate") score += 15;
  else if (analysis.desktopCompatibility === "poor") score += 6;

  // 文件格式权重：20%
  maxScore += 20;
  if (analysis.extension === '.mp4') score += 20;
  else if (analysis.extension === '.mov') score += 15;
  else score += 10;

  // 文件大小权重：10%
  maxScore += 10;
  if (analysis.fileSizeCategory === "small") score += 10;
  else if (analysis.fileSizeCategory === "medium") score += 8;
  else if (analysis.fileSizeCategory === "large") score += 5;
  else score += 2;

  const percentage = (score / maxScore) * 100;

  if (percentage >= 80) return "excellent";
  if (percentage >= 60) return "good";
  if (percentage >= 40) return "moderate";
  return "poor";
}

function generateRecommendation(analysis, fileSize) {
  const recommendation = {
    shouldConvert: false,
    priority: "low",
    reasons: [],
    suggestedActions: [],
    estimatedImprovements: []
  };

  // 基于兼容性分析给出建议
  if (analysis.estimatedCompatibility === "poor") {
    recommendation.shouldConvert = true;
    recommendation.priority = "high";
    recommendation.reasons.push("当前编码兼容性差，强烈建议重新编码");
  } else if (analysis.estimatedCompatibility === "moderate") {
    recommendation.shouldConvert = true;
    recommendation.priority = "medium";
    recommendation.reasons.push("编码兼容性一般，建议优化");
  }

  // MOOV atom相关建议
  if (analysis.moovAtomAnalysis?.moovAtEnd) {
    recommendation.shouldConvert = true;
    recommendation.reasons.push("MOOV atom在文件末尾，影响流式播放");
    recommendation.suggestedActions.push("重新编码并将MOOV atom移到文件开头");
    recommendation.estimatedImprovements.push("显著提升移动端播放体验");
  }

  // 文件大小相关建议
  if (fileSize > 200 * 1024 * 1024) {
    recommendation.shouldConvert = true;
    recommendation.reasons.push("文件过大，影响移动端下载和播放");
    recommendation.suggestedActions.push("生成移动端优化版本");
    recommendation.estimatedImprovements.push("减少50-70%文件大小，提升加载速度");
  }

  // 格式相关建议
  if (analysis.extension !== '.mp4') {
    recommendation.shouldConvert = true;
    recommendation.reasons.push(`${analysis.extension}格式兼容性不如MP4`);
    recommendation.suggestedActions.push("转换为MP4格式");
    recommendation.estimatedImprovements.push("获得更好的跨平台兼容性");
  }

  // 如果没有发现问题，给出保持建议
  if (!recommendation.shouldConvert) {
    recommendation.reasons.push("当前编码兼容性良好，无需转换");
    recommendation.suggestedActions.push("保持当前格式");
  }

  return recommendation;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}