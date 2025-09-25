import { HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { processVideo } from "./video-converter.mjs";
import { spawn } from 'child_process';
import { promisify } from 'util';

/**
 * 尝试分析本地视频文件
 */
async function tryAnalyzeFile(filePath, result) {
  try {
    // 使用ffprobe检测本地文件
    const ffprobeCommand = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=profile,level,width,height,codec_name',
      '-of', 'json',
      filePath
    ];

    console.log(`🔧 执行ffprobe命令: ffprobe ${ffprobeCommand.join(' ')}`);

    // Lambda层中的ffprobe路径
    const ffprobePath = process.env.AWS_LAMBDA_FUNCTION_NAME ? '/opt/bin/ffprobe' : 'ffprobe';

    const ffprobeProcess = spawn(ffprobePath, ffprobeCommand);
    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // 等待进程完成，添加10秒超时
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ffprobeProcess.kill();
        reject(new Error(`ffprobe超时 (10秒)`));
      }, 10000);

      ffprobeProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffprobe退出码: ${code}, stderr: ${stderr}`));
        }
      });

      ffprobeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`ffprobe执行失败: ${error.message}`));
      });
    });

    // 解析ffprobe输出
    const probeData = JSON.parse(stdout);
    if (probeData.streams && probeData.streams.length > 0) {
      const videoStream = probeData.streams[0];

      result.profile = videoStream.profile || null;
      result.level = videoStream.level || null;
      result.width = videoStream.width || null;
      result.height = videoStream.height || null;
      result.detected = true;

      console.log(`✅ ffprobe检测完成:`, {
        profile: result.profile,
        level: result.level,
        resolution: `${result.width}x${result.height}`,
        codec: videoStream.codec_name
      });

      return true; // 分析成功
    }

    return false; // 没有找到视频流
  } catch (error) {
    console.log(`ffprobe分析失败: ${error.message}`);
    return false; // 分析失败
  }
}

/**
 * 使用ffprobe检测H.264编码参数
 * 返回profile和level信息，这是移动端兼容性的关键因素
 */
async function detectH264ProfileLevel(videoKey) {
  console.log(`🔬 开始ffprobe检测H.264参数: ${videoKey}`);

  // 首先尝试使用智能MP4 box解析器
  try {
    // 获取文件大小
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const headInfo = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    }));
    const fileSize = headInfo.ContentLength;

    // 使用智能解析器精确查找并分析MOOV box
    const { smartDetectH264Profile } = await import("./mp4-box-parser.mjs");
    const smartResult = await smartDetectH264Profile(videoKey, fileSize);

    if (smartResult.detected) {
      console.log(`✅ 智能解析成功: Profile=${smartResult.profile}, Level=${smartResult.level}`);
      return smartResult;
    }

    console.log(`⚠️ 智能解析未能检测到H264信息，尝试传统方法`);
  } catch (smartError) {
    console.log(`⚠️ 智能解析失败: ${smartError.message}，回退到传统方法`);
  }

  // 如果智能解析失败，回退到原来的方法
  const result = {
    profile: null,
    level: null,
    width: null,
    height: null,
    detected: false,
    error: null
  };

  try {
    // 由于Lambda层ffprobe不支持HTTPS，下载文件头部到临时目录进行分析
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const fs = await import('fs');
    const path = await import('path');

    // 创建临时文件路径
    const tempFileName = `video_${Date.now()}.mp4`;
    const tempFilePath = path.join('/tmp', tempFileName);

    console.log(`📁 回退方案：下载视频文件头部到临时目录: ${tempFilePath}`);

    // 智能下载策略：先尝试文件头部，失败则尝试文件尾部
    let downloadSuccess = false;

    // 策略1：下载文件头部1MB
    try {
      console.log(`📁 策略1: 下载文件头部1MB`);
      const headCommand = new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoKey,
        Range: "bytes=0-1048575" // 1MB
      });

      const headResponse = await s3Client.send(headCommand);
      const headChunks = [];
      for await (const chunk of headResponse.Body) {
        headChunks.push(chunk);
      }
      const headBuffer = Buffer.concat(headChunks);

      fs.writeFileSync(tempFilePath, headBuffer);
      console.log(`✅ 头部下载完成，文件大小: ${headBuffer.length} bytes`);

      downloadSuccess = await tryAnalyzeFile(tempFilePath, result);
      if (downloadSuccess) {
        console.log(`🎯 文件头部分析成功`);
      }
    } catch (headError) {
      console.log(`⚠️ 文件头部分析失败: ${headError.message}`);
    }

    // 策略2：如果头部失败且包含"moov atom not found"，尝试文件尾部
    if (!downloadSuccess) {
      console.log(`📁 策略2: 下载文件尾部1MB`);

      // 先获取文件大小
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const headInfo = await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoKey,
      }));

      const fileSize = headInfo.ContentLength;
      const tailStart = Math.max(0, fileSize - 1048576); // 最后1MB

      try {
        const tailCommand = new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: videoKey,
          Range: `bytes=${tailStart}-${fileSize - 1}`
        });

        const tailResponse = await s3Client.send(tailCommand);
        const tailChunks = [];
        for await (const chunk of tailResponse.Body) {
          tailChunks.push(chunk);
        }
        const tailBuffer = Buffer.concat(tailChunks);

        // 创建一个新的临时文件用于尾部分析
        const tempTailPath = tempFilePath.replace('.mp4', '_tail.mp4');
        fs.writeFileSync(tempTailPath, tailBuffer);
        console.log(`✅ 尾部下载完成，文件大小: ${tailBuffer.length} bytes`);

        downloadSuccess = await tryAnalyzeFile(tempTailPath, result);

        // 清理尾部临时文件
        try {
          if (fs.existsSync(tempTailPath)) {
            fs.unlinkSync(tempTailPath);
            console.log(`🗑️ 清理尾部临时文件: ${tempTailPath}`);
          }
        } catch (cleanupError) {
          console.log(`⚠️ 清理尾部临时文件失败: ${cleanupError.message}`);
        }

        if (downloadSuccess) {
          console.log(`🎯 文件尾部分析成功`);
        }
      } catch (tailError) {
        console.log(`❌ 文件尾部分析失败: ${tailError.message}`);
      }
    }

    if (!downloadSuccess) {
      console.log(`❌ 头部和尾部分析都失败，无法获取视频流信息`);
    }

    return result;

  } catch (error) {
    console.error('❌ ffprobe检测失败:', error);
    result.error = error.message;
    return result;
  } finally {
    // 清理临时文件
    try {
      if (typeof tempFilePath !== 'undefined') {
        const fs = require('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`🗑️ 清理临时文件: ${tempFilePath}`);
        }
      }
    } catch (cleanupError) {
      console.log(`⚠️ 清理临时文件失败: ${cleanupError.message}`);
    }
  }
}

/**
 * 基于MOOV位置判断移动端兼容性
 * 关键发现：MOOV必须在mdat之前，否则Safari移动端无法播放
 */
function assessMobileCompatibilityFromH264(profileLevelData) {
  if (!profileLevelData.detected) {
    return {
      compatible: 'unknown',
      reason: 'ffprobe检测失败',
      needsMobile: true,
      needsFaststart: true
    };
  }

  // 关键判断：MOOV位置决定移动端兼容性
  const isMobileCompatible = profileLevelData.isMobileCompatible;
  const moovPosition = profileLevelData.moovPosition;

  if (isMobileCompatible && moovPosition === 'before_mdat') {
    return {
      compatible: 'excellent',
      reason: 'MOOV atom在mdat之前，Safari移动端完全兼容',
      needsMobile: false,
      needsFaststart: false
    };
  } else if (moovPosition === 'after_mdat') {
    return {
      compatible: 'poor',
      reason: 'MOOV atom在mdat之后，Safari移动端无法流式播放',
      needsMobile: true,
      needsFaststart: true
    };
  }

  // 如果MOOV位置信息不可用，使用传统的profile/level判断作为fallback
  const { profile, level } = profileLevelData;

  if (profile === 'Baseline' || profile === 'Constrained Baseline') {
    return {
      compatible: 'good',
      reason: 'Baseline profile通常移动端兼容，但建议使用faststart优化',
      needsMobile: false,
      needsFaststart: true
    };
  }

  // 其他情况，安全起见建议生成mobile版本
  return {
    compatible: 'unknown',
    reason: 'MOOV位置信息不可用，基于安全考虑建议生成mobile版本',
    needsMobile: true,
    needsFaststart: true
  };
}

/**
 * 分析视频文件的编码兼容性
 * 主要检查以下几个关键因素：
 * 1. H.264编码配置（Profile、Level）- 决定是否需要mobile版本
 * 2. MOOV atom位置 - 影响播放体验
 * 3. 帧率和分辨率 - 影响性能
 * 4. 音频编码格式 - 影响兼容性
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
    const analysisResponse = await analyzeVideoCompatibility(videoKey);

    // analyzeVideoCompatibility返回的是Lambda响应格式，需要解析body
    const analysisResult = JSON.parse(analysisResponse.body);

    if (!analysisResult.success) {
      return analysisResponse;
    }

    const { recommendation } = analysisResult;
    let conversionResult = null;

    // 如果建议转换且启用了自动转换
    if (autoConvert && recommendation.shouldConvert) {
      console.log("🔄 触发自动视频转换...");
      console.log("转换原因:", recommendation.reasons);
      console.log("🔧 调试信息: autoConvert =", autoConvert, ", shouldConvert =", recommendation.shouldConvert);

      try {
        // 检查是否是MOOV atom问题
        const isMoovIssue = recommendation.reasons.some(reason =>
          reason.includes("MOOV") || reason.includes("mdat")
        );

        // 构建转换配置
        const settings = {
          quality: "standard",
          format: "mp4",
          resolution: "720p",
          enableMobile: true,
          // 如果是MOOV问题，只生成mobile版本，否则生成两个版本
          skipMainOutput: isMoovIssue
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
        const conversionResponse = await processVideo(
          videoKey,
          "videos", // 输出目录保持在videos文件夹下，使用替换策略
          settings,
          user
        );

        // processVideo返回的是Lambda响应格式，需要解析body
        conversionResult = JSON.parse(conversionResponse.body);

        console.log("✅ 自动转换已启动:", conversionResult.jobId);

      } catch (conversionError) {
        console.error("❌ 自动转换启动失败:", conversionError);
        console.error("❌ 详细错误:", conversionError.stack);
        // 不阻断主流程，返回分析结果但标记转换失败
        conversionResult = {
          success: false,
          error: conversionError.message,
          message: "Analysis completed but auto-conversion failed"
        };
      }
    } else {
      console.log("🎯 视频兼容性良好，无需转换");
      console.log("🔧 调试信息: autoConvert =", autoConvert, ", shouldConvert =", recommendation.shouldConvert);
    }

    // 返回综合结果
    console.log("🔧 构建最终响应 - autoConvert:", autoConvert, "shouldConvert:", recommendation.shouldConvert);
    const finalResponse = createSuccessResponse({
      ...analysisResult,
      autoConversion: {
        enabled: autoConvert,
        triggered: autoConvert && recommendation.shouldConvert,
        result: conversionResult
      }
    });

    console.log("📤 最终响应autoConversion字段:", finalResponse.data?.autoConversion || finalResponse.autoConversion);
    return finalResponse;

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
    moovAtomAnalysis: null,
    h264Analysis: null // 新增H.264分析结果
  };

  try {
    // 第一步：使用ffprobe检测H.264编码参数 - 这是移动端兼容性的最关键因素
    const h264Analysis = await detectH264ProfileLevel(videoKey);
    analysis.h264Analysis = h264Analysis;

    // 基于H.264参数判断移动端兼容性
    const mobileCompatibilityAssessment = assessMobileCompatibilityFromH264(h264Analysis);
    analysis.mobileCompatibility = mobileCompatibilityAssessment.compatible;

    // 将兼容性判断结果添加到h264Analysis中，传递给前端
    if (h264Analysis) {
      h264Analysis.needsMobile = mobileCompatibilityAssessment.needsMobile;
      h264Analysis.needsFaststart = mobileCompatibilityAssessment.needsFaststart;
      h264Analysis.compatibilityReason = mobileCompatibilityAssessment.reason;
    }

    if (mobileCompatibilityAssessment.needsMobile) {
      analysis.issues.push(mobileCompatibilityAssessment.reason);
    } else {
      analysis.strengths.push(mobileCompatibilityAssessment.reason);
    }

    // 第二步：使用智能检测的MOOV位置结果
    if (h264Analysis && h264Analysis.moovPosition) {
      analysis.moovAtomAnalysis = {
        moovAtBeginning: h264Analysis.moovPosition === 'before_mdat',
        moovAtEnd: h264Analysis.moovPosition === 'after_mdat',
        isFastStart: h264Analysis.moovPosition === 'before_mdat'
      };
      console.log(`使用智能检测的MOOV位置: ${h264Analysis.moovPosition}`);
    } else {
      // 如果智能检测没有MOOV信息，使用传统方法作为fallback
      const moovAnalysis = await analyzeMoovAtomPosition(videoKey, fileSize);
      analysis.moovAtomAnalysis = moovAnalysis;
    }

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

      // MOOV atom位置检查（现在基于智能检测结果）
      if (analysis.moovAtomAnalysis?.moovAtBeginning) {
        // MOOV在开头的情况已经在mobileCompatibilityAssessment中处理
        analysis.strengths.push("MOOV atom在文件开头，支持流式播放");
      } else if (analysis.moovAtomAnalysis?.moovAtEnd) {
        // MOOV在末尾的情况已经在mobileCompatibilityAssessment中处理
        analysis.issues.push("MOOV atom在文件末尾，移动端可能需要完整下载后才能播放");
      } else {
        // 位置不明确的情况已经在mobileCompatibilityAssessment中处理
        analysis.issues.push("未检测到MOOV atom或位置不明确");
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

  // 第一优先级：基于H.264 Profile/Level决定是否需要mobile版本
  if (analysis.h264Analysis?.detected) {
    const h264Compatibility = assessMobileCompatibilityFromH264(analysis.h264Analysis);

    if (h264Compatibility.needsMobile) {
      recommendation.shouldConvert = true;
      recommendation.priority = "critical";
      recommendation.reasons.push(`H.264 ${h264Compatibility.reason}`);
      recommendation.suggestedActions.push("生成移动端兼容版本");
      recommendation.estimatedImprovements.push("确保移动端设备可以正常播放");
    }
  } else {
    // ffprobe检测失败时，安全起见默认生成mobile版本
    recommendation.shouldConvert = true;
    recommendation.priority = "medium";
    recommendation.reasons.push("无法检测H.264编码参数，建议生成移动端版本以确保兼容性");
    recommendation.suggestedActions.push("生成移动端兼容版本");
  }

  // 第二优先级：基于兼容性分析给出播放体验优化建议
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