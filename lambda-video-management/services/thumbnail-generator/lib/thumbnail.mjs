import { HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { spawn } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

export async function generateThumbnail(videoKey) {
  try {
    console.log("=== 开始生成缩略图 ===");
    console.log("视频文件:", videoKey);

    // 检查视频文件是否存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoKey,
      }));
    } catch (headError) {
      if (headError.name === "NotFound") {
        return createErrorResponse(404, "Video file not found");
      }
      throw headError;
    }

    // 生成缩略图key: videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg
    const thumbnailKey = videoKey
      .replace(/^videos\//, 'thumbnails/')  // videos/ -> thumbnails/
      .replace(/\.[^/.]+$/, '.jpg');        // .mp4 -> .jpg
    console.log("缩略图将保存为:", thumbnailKey);

    // 检查缩略图是否已存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
      }));

      console.log("缩略图已存在，返回现有的");
      const thumbnailUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: thumbnailKey }),
        { expiresIn: 3600 }
      );

      return createSuccessResponse({
        success: true,
        thumbnailUrl,
        thumbnailKey,
        cached: true
      });

    } catch (headError) {
      if (headError.name !== "NotFound") {
        throw headError;
      }
      // 缩略图不存在，继续生成
    }

    // 对于大文件，只下载前50MB用于缩略图生成
    const maxDownloadSize = 50 * 1024 * 1024; // 50MB

    // 首先获取文件大小
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    }));
    const fileSize = headResult.ContentLength;
    console.log(`视频文件大小: ${fileSize} bytes`);

    // 决定下载大小
    const downloadSize = Math.min(fileSize, maxDownloadSize);
    console.log(`将下载前 ${downloadSize} bytes 用于缩略图生成`);

    // 生成视频的预签名URL用于部分下载
    const videoUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: videoKey }),
      { expiresIn: 3600 }
    );

    console.log("开始使用ffmpeg生成缩略图");

    // 设置临时文件路径
    const tempDir = "/tmp";
    const videoPath = path.join(tempDir, `input_${Date.now()}.mp4`);
    const thumbnailPath = path.join(tempDir, `thumbnail_${Date.now()}.jpg`);

    try {
      // 下载视频文件的前部分到临时目录
      console.log("下载视频文件前部分...");
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'Range': `bytes=0-${downloadSize - 1}`
        }
      });

      if (!videoResponse.ok && videoResponse.status !== 206) {
        throw new Error(`视频下载失败: ${videoResponse.status}`);
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      writeFileSync(videoPath, Buffer.from(videoBuffer));
      console.log("视频文件下载完成:", videoPath, `(${videoBuffer.byteLength} bytes)`);

      // 使用ffmpeg生成缩略图
      const ffmpegPath = "/opt/bin/ffmpeg";
      console.log("执行ffmpeg命令...");

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
          "-i", videoPath,
          "-vf", "thumbnail,scale=320:240",
          "-frames:v", "1",
          "-f", "image2",
          "-y",
          thumbnailPath
        ]);

        let stdout = "";
        let stderr = "";

        ffmpeg.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        ffmpeg.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        ffmpeg.on("close", (code) => {
          console.log("ffmpeg退出码:", code);
          if (stderr) console.log("ffmpeg错误输出:", stderr);

          if (code === 0 && existsSync(thumbnailPath)) {
            console.log("缩略图生成成功");
            resolve();
          } else {
            console.error("ffmpeg执行失败");
            reject(new Error(`ffmpeg失败: code ${code}`));
          }
        });

        ffmpeg.on("error", (error) => {
          console.error("ffmpeg spawn失败:", error);
          reject(error);
        });
      });

      // 读取生成的缩略图
      const thumbnailBuffer = readFileSync(thumbnailPath);
      console.log("缩略图文件大小:", thumbnailBuffer.length, "bytes");

      // 上传缩略图到S3
      await s3Client.send(new PutObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: "image/jpeg",
        Metadata: {
          "generated-from": videoKey,
          "generated-at": new Date().toISOString()
        }
      }));

      console.log("缩略图上传成功");

      // 生成缩略图的预签名URL
      const thumbnailUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: thumbnailKey }),
        { expiresIn: 3600 }
      );

      // 清理临时文件
      try {
        if (existsSync(videoPath)) unlinkSync(videoPath);
        if (existsSync(thumbnailPath)) unlinkSync(thumbnailPath);
      } catch (cleanupError) {
        console.warn("清理临时文件失败:", cleanupError);
      }

      return createSuccessResponse({
        success: true,
        thumbnailUrl,
        thumbnailKey,
        cached: false
      });

    } catch (processingError) {
      // 清理临时文件
      try {
        if (existsSync(videoPath)) unlinkSync(videoPath);
        if (existsSync(thumbnailPath)) unlinkSync(thumbnailPath);
      } catch (cleanupError) {
        console.warn("清理临时文件失败:", cleanupError);
      }
      throw processingError;
    }

  } catch (error) {
    console.error("生成缩略图失败:", error);
    return createErrorResponse(500, "Failed to generate thumbnail", error.message);
  }
}