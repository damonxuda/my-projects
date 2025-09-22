import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../../shared/s3-config.mjs";
import ytdlp from "yt-dlp-exec";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

export async function downloadYouTubeVideo(event, user) {
  try {
    console.log("=== 开始YouTube视频下载 ===");

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { url, quality = "720p", folder = "", customName = "" } = body;

    if (!url) {
      return createErrorResponse(400, "Missing required parameter: url");
    }

    // 验证YouTube URL
    if (!isValidYouTubeUrl(url)) {
      return createErrorResponse(400, "Invalid YouTube URL");
    }

    console.log("YouTube URL:", url);
    console.log("Quality:", quality);
    console.log("Target folder:", folder);

    // 获取视频信息
    console.log("获取视频信息...");
    let videoInfo;
    try {
      videoInfo = await ytdlp(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:googlebot'
        ]
      });
    } catch (infoError) {
      console.error("获取视频信息失败:", infoError);
      return createErrorResponse(400, "Failed to get video information", "无法获取视频信息，请检查URL是否正确");
    }

    // 生成文件名
    const sanitizedTitle = sanitizeFileName(customName || videoInfo.title || "unknown_video");
    const videoId = videoInfo.id || "unknown_id";
    const ext = getVideoExtension(quality);
    const fileName = `${sanitizedTitle}_${videoId}${ext}`;

    // 构建S3存储路径
    const s3Key = folder
      ? `videos/${folder}/${fileName}`
      : `videos/${fileName}`;

    console.log("Target S3 key:", s3Key);

    // 设置临时文件路径
    const tempDir = "/tmp";
    const tempVideoPath = path.join(tempDir, `download_${Date.now()}_${videoId}${ext}`);

    try {
      // 下载视频
      console.log("开始下载视频...");
      const downloadOptions = {
        output: tempVideoPath,
        format: getYoutubeDlFormat(quality),
        noCheckCertificates: true,
        noWarnings: true,
        extractFlat: false,
        writeThumbnail: false,
        writeInfoJson: false,
        addHeader: [
          'referer:youtube.com',
          'user-agent:googlebot'
        ]
      };

      await ytdlp(url, downloadOptions);

      if (!existsSync(tempVideoPath)) {
        throw new Error("下载的视频文件不存在");
      }

      // 读取下载的视频文件
      const videoBuffer = readFileSync(tempVideoPath);
      console.log("视频文件大小:", videoBuffer.length, "bytes");

      if (videoBuffer.length === 0) {
        throw new Error("下载的视频文件为空");
      }

      // 上传到S3
      console.log("上传视频到S3...");
      await s3Client.send(new PutObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: s3Key,
        Body: videoBuffer,
        ContentType: getContentType(ext),
        Metadata: {
          "source": "youtube",
          "original-url": url,
          "video-id": videoId,
          "title": videoInfo.title || "",
          "duration": videoInfo.duration?.toString() || "",
          "uploader": videoInfo.uploader || "",
          "download-date": new Date().toISOString(),
          "downloaded-by": user.id,
          "quality": quality
        }
      }));

      console.log("视频上传成功");

      // 清理临时文件
      try {
        if (existsSync(tempVideoPath)) {
          unlinkSync(tempVideoPath);
        }
      } catch (cleanupError) {
        console.warn("清理临时文件失败:", cleanupError);
      }

      // 记录下载历史
      const downloadRecord = {
        timestamp: new Date().toISOString(),
        userId: user.id,
        youtubeUrl: url,
        videoId: videoId,
        title: videoInfo.title || "",
        s3Key: s3Key,
        quality: quality,
        fileSize: videoBuffer.length,
        duration: videoInfo.duration || 0
      };

      console.log("下载完成:", downloadRecord);

      return createSuccessResponse({
        success: true,
        message: "YouTube video downloaded successfully",
        videoInfo: {
          title: videoInfo.title,
          id: videoId,
          duration: videoInfo.duration,
          uploader: videoInfo.uploader,
          uploadDate: videoInfo.upload_date
        },
        downloadInfo: {
          s3Key: s3Key,
          fileName: fileName,
          quality: quality,
          fileSize: videoBuffer.length,
          downloadedAt: downloadRecord.timestamp
        }
      });

    } catch (downloadError) {
      // 清理临时文件
      try {
        if (existsSync(tempVideoPath)) {
          unlinkSync(tempVideoPath);
        }
      } catch (cleanupError) {
        console.warn("清理临时文件失败:", cleanupError);
      }

      throw downloadError;
    }

  } catch (error) {
    console.error("YouTube视频下载失败:", error);

    // 根据错误类型返回更友好的错误信息
    let errorMessage = error.message;
    if (error.message.includes("Video unavailable")) {
      errorMessage = "视频不可用，可能已被删除或设为私有";
    } else if (error.message.includes("Sign in to confirm")) {
      errorMessage = "该视频需要登录才能观看，无法下载";
    } else if (error.message.includes("Private video")) {
      errorMessage = "这是私有视频，无法下载";
    } else if (error.message.includes("429")) {
      errorMessage = "请求过于频繁，请稍后再试";
    }

    return createErrorResponse(500, "Failed to download YouTube video", errorMessage);
  }
}

function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[a-zA-Z0-9_-]{11}/;
  return youtubeRegex.test(url);
}

function sanitizeFileName(fileName) {
  // 移除或替换不安全的字符
  return fileName
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '')
    .slice(0, 100); // 限制长度
}

function getVideoExtension(quality) {
  // YouTube通常提供mp4格式
  return '.mp4';
}

function getContentType(ext) {
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo'
  };
  return contentTypes[ext] || 'video/mp4';
}

function getYoutubeDlFormat(quality) {
  const formatMap = {
    "480p": "best[height<=480]",
    "720p": "best[height<=720]",
    "1080p": "best[height<=1080]",
    "best": "best",
    "worst": "worst"
  };

  return formatMap[quality] || formatMap["720p"];
}