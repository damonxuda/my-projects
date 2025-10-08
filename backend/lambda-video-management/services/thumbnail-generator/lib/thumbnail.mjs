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
        new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
          ResponseCacheControl: 'max-age=3600, must-revalidate',
          ResponseContentType: 'image/jpeg'
        }),
        {
          expiresIn: 6 * 60 * 60, // 改为6小时保持一致
          signableHeaders: new Set(['host', 'x-amz-date'])
        }
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

    // 首先获取文件大小
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    }));
    const fileSize = headResult.ContentLength;
    console.log(`视频文件大小: ${fileSize} bytes`);

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
      // 智能MOOV atom检测和下载策略
      console.log("开始智能检测MOOV atom位置...");

      // 第一步：检查MOOV atom是否在文件开头（前8KB）
      console.log("检查文件开头是否包含MOOV atom...");
      const headerResponse = await fetch(videoUrl, {
        headers: {
          'Range': `bytes=0-8191` // 前8KB
        }
      });

      if (!headerResponse.ok && headerResponse.status !== 206) {
        throw new Error(`获取文件头部失败: ${headerResponse.status}`);
      }

      const headerBuffer = Buffer.from(await headerResponse.arrayBuffer());
      const hasMoovAtBeginning = headerBuffer.includes(Buffer.from('moov'));

      console.log(`文件头部MOOV检测结果: ${hasMoovAtBeginning ? '找到' : '未找到'}`);

      let downloadStrategy;
      let videoBuffer;

      if (hasMoovAtBeginning) {
        // MOOV在开头：只需下载前部分即可
        const downloadSize = Math.min(fileSize, 5 * 1024 * 1024); // 5MB应该够了
        console.log(`MOOV在开头，下载前${Math.round(downloadSize/1024/1024)}MB...`);

        const videoResponse = await fetch(videoUrl, {
          headers: {
            'Range': `bytes=0-${downloadSize - 1}`
          }
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
          throw new Error(`视频下载失败: ${videoResponse.status}`);
        }

        videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        downloadStrategy = 'front-only';
      } else {
        // MOOV可能在文件末尾：检查末尾8KB
        console.log("检查文件末尾是否包含MOOV atom...");
        const tailResponse = await fetch(videoUrl, {
          headers: {
            'Range': `bytes=-8192` // 末尾8KB
          }
        });

        if (!tailResponse.ok && tailResponse.status !== 206) {
          throw new Error(`获取文件尾部失败: ${tailResponse.status}`);
        }

        const tailBuffer = Buffer.from(await tailResponse.arrayBuffer());
        const hasMoovAtEnd = tailBuffer.includes(Buffer.from('moov'));

        console.log(`文件尾部MOOV检测结果: ${hasMoovAtEnd ? '找到' : '未找到'}`);

        if (hasMoovAtEnd) {
          // MOOV在末尾：下载前面部分+末尾部分，然后重新组合
          const frontSize = Math.min(fileSize, 3 * 1024 * 1024); // 前3MB
          const tailSize = Math.min(fileSize, 2 * 1024 * 1024);  // 末尾2MB

          console.log(`MOOV在末尾，下载前${Math.round(frontSize/1024/1024)}MB + 末尾${Math.round(tailSize/1024/1024)}MB...`);

          // 并行下载前部分和末尾部分
          const [frontResponse, tailResponse2] = await Promise.all([
            fetch(videoUrl, {
              headers: { 'Range': `bytes=0-${frontSize - 1}` }
            }),
            fetch(videoUrl, {
              headers: { 'Range': `bytes=-${tailSize}` }
            })
          ]);

          if ((!frontResponse.ok && frontResponse.status !== 206) ||
              (!tailResponse2.ok && tailResponse2.status !== 206)) {
            throw new Error('下载前部分或尾部失败');
          }

          const frontBuffer = Buffer.from(await frontResponse.arrayBuffer());
          const tailBuffer2 = Buffer.from(await tailResponse2.arrayBuffer());

          // 合并前部分和尾部
          videoBuffer = Buffer.concat([frontBuffer, tailBuffer2]);
          downloadStrategy = 'front-and-tail';
        } else {
          // 没有找到MOOV atom的处理策略
          if (fileSize < 50 * 1024 * 1024) {
            // 小文件（<50MB）：直接下载整个文件
            console.log(`文件较小(${Math.round(fileSize/1024/1024)}MB)，下载完整文件...`);

            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) {
              throw new Error(`完整文件下载失败: ${videoResponse.status}`);
            }

            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            downloadStrategy = 'complete-small-file';
          } else {
            // 大文件且未检测到MOOV：尝试更智能的策略
            console.log(`未检测到MOOV位置，尝试多段下载策略...`);

            // 策略1: 下载更大的前端 + 中间段 + 尾端
            const frontSize = Math.min(fileSize, 15 * 1024 * 1024); // 前15MB
            const middleSize = Math.min(fileSize, 5 * 1024 * 1024);  // 中间5MB
            const tailSize = Math.min(fileSize, 5 * 1024 * 1024);    // 末尾5MB
            const middleStart = Math.floor(fileSize / 2) - Math.floor(middleSize / 2); // 中间位置

            if (fileSize < 100 * 1024 * 1024) {
              // 小于100MB的文件，直接下载完整文件
              console.log(`文件适中(${Math.round(fileSize/1024/1024)}MB)，下载完整文件确保MOOV完整...`);

              const videoResponse = await fetch(videoUrl);
              if (!videoResponse.ok) {
                throw new Error(`完整文件下载失败: ${videoResponse.status}`);
              }

              videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
              downloadStrategy = 'complete-for-moov';
            } else {
              // 大文件：三段下载策略
              console.log(`大文件三段下载: 前${Math.round(frontSize/1024/1024)}MB + 中间${Math.round(middleSize/1024/1024)}MB + 末${Math.round(tailSize/1024/1024)}MB...`);

              const [frontResponse, middleResponse, tailResponse2] = await Promise.all([
                fetch(videoUrl, {
                  headers: { 'Range': `bytes=0-${frontSize - 1}` }
                }),
                fetch(videoUrl, {
                  headers: { 'Range': `bytes=${middleStart}-${middleStart + middleSize - 1}` }
                }),
                fetch(videoUrl, {
                  headers: { 'Range': `bytes=-${tailSize}` }
                })
              ]);

              if ((!frontResponse.ok && frontResponse.status !== 206) ||
                  (!middleResponse.ok && middleResponse.status !== 206) ||
                  (!tailResponse2.ok && tailResponse2.status !== 206)) {
                throw new Error('三段下载失败');
              }

              const frontBuffer = Buffer.from(await frontResponse.arrayBuffer());
              const middleBuffer = Buffer.from(await middleResponse.arrayBuffer());
              const tailBuffer2 = Buffer.from(await tailResponse2.arrayBuffer());

              // 合并三段数据
              videoBuffer = Buffer.concat([frontBuffer, middleBuffer, tailBuffer2]);
              downloadStrategy = 'three-segment';
            }
          }
        }
      }

      writeFileSync(videoPath, videoBuffer);
      console.log(`视频文件下载完成 (${downloadStrategy}):`, videoPath, `(${videoBuffer.byteLength} bytes)`);

      // 使用ffmpeg生成缩略图 - 支持新旧ffmpeg层
      let ffmpegPath;
      const possiblePaths = [
        "/opt/ffmpeg-layer/bin/ffmpeg", // 实际新层路径 (FFmpeg 7.x for Node.js 20.x)
        "/opt/ffmpeg/bin/ffmpeg",  // 新层路径备用
        "/opt/bin/ffmpeg",         // 旧层路径
        "/usr/local/bin/ffmpeg",   // 备用路径
        "/var/runtime/ffmpeg"      // 另一个可能路径
      ];

      // 查找可用的ffmpeg路径
      for (const path of possiblePaths) {
        try {
          if (existsSync(path)) {
            ffmpegPath = path;
            console.log(`找到ffmpeg: ${ffmpegPath}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个路径
        }
      }

      if (!ffmpegPath) {
        throw new Error("未找到ffmpeg可执行文件，检查的路径: " + possiblePaths.join(", "));
      }

      console.log("执行ffmpeg命令...");

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
          "-i", videoPath,
          "-ss", "1",  // 从第1秒开始，跳过可能损坏的开头
          "-vf", "scale=320:240",  // 移除thumbnail filter，直接缩放
          "-frames:v", "1",
          "-f", "image2",
          "-threads", "1",  // 限制线程数量减少内存使用
          "-preset", "ultrafast",  // 最快编码减少内存缓冲
          "-avoid_negative_ts", "make_zero",  // 处理时间戳问题
          "-fflags", "+genpts+igndts",  // 忽略损坏的时间戳，生成新的
          "-analyzeduration", "100M",  // 增加分析时间
          "-probesize", "100M",  // 增加探测大小
          "-err_detect", "ignore_err",  // 忽略错误继续处理
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
          "generated-from": encodeURIComponent(videoKey),  // 编码中文文件名
          "generated-at": new Date().toISOString(),
          "file-size": fileSize.toString()
        }
      }));

      console.log("缩略图上传成功");

      // 生成缩略图的预签名URL
      const thumbnailUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
          ResponseCacheControl: 'max-age=3600, must-revalidate',
          ResponseContentType: 'image/jpeg'
        }),
        {
          expiresIn: 6 * 60 * 60, // 改为6小时保持一致
          signableHeaders: new Set(['host', 'x-amz-date'])
        }
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