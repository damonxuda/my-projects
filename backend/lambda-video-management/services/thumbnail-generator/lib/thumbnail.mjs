import { HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { spawn } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

/**
 * 解析MP4文件的box结构，精确定位moov atom的位置
 * @param {Buffer} buffer - MP4文件的前部分数据（至少几KB）
 * @param {number} maxScanSize - 最大扫描大小（字节）
 * @returns {Object|null} { offset: number, size: number } 或 null
 */
function parseMoovLocation(buffer, maxScanSize = 1024 * 1024) {
  let offset = 0;
  const scanLimit = Math.min(buffer.length, maxScanSize);

  console.log(`📦 开始解析MP4 box结构，扫描范围: ${scanLimit} bytes`);

  while (offset < scanLimit - 8) {
    // 读取box header (8 bytes)
    // 前4字节：box大小（big-endian）
    // 后4字节：box类型（ASCII）

    const boxSize = buffer.readUInt32BE(offset);
    const boxType = buffer.toString('ascii', offset + 4, offset + 8);

    console.log(`  📍 偏移 ${offset}: 类型="${boxType}", 大小=${boxSize} bytes`);

    // 检查box大小的合法性
    if (boxSize < 8) {
      console.log(`  ⚠️  box大小异常 (${boxSize} < 8)，停止解析`);
      break;
    }

    // 特殊情况：boxSize = 1 表示使用64位扩展大小
    if (boxSize === 1) {
      if (offset + 16 > buffer.length) {
        console.log(`  ⚠️  需要64位大小但buffer不足，停止解析`);
        break;
      }
      // 读取8字节的扩展大小（跳过，因为我们主要关注位置）
      const extendedSize = Number(buffer.readBigUInt64BE(offset + 8));
      console.log(`  📍 使用扩展大小: ${extendedSize} bytes`);

      if (boxType === 'moov') {
        console.log(`  ✅ 找到moov atom! 偏移=${offset}, 大小=${extendedSize}`);
        return { offset, size: extendedSize };
      }

      offset += extendedSize;
      continue;
    }

    // 特殊情况：boxSize = 0 表示box延伸到文件末尾
    if (boxSize === 0) {
      console.log(`  📍 box延伸到文件末尾 (size=0)`);
      if (boxType === 'moov') {
        console.log(`  ✅ 找到moov atom (延伸到文件末尾)! 偏移=${offset}`);
        return { offset, size: 0 }; // size=0表示到文件末尾
      }
      break;
    }

    // 找到moov atom
    if (boxType === 'moov') {
      console.log(`  ✅ 找到moov atom! 偏移=${offset}, 大小=${boxSize}`);
      return { offset, size: boxSize };
    }

    // 继续扫描下一个box
    offset += boxSize;
  }

  console.log(`  ❌ 未在前${scanLimit}字节中找到moov atom`);
  return null;
}

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
      console.log("🔍 开始智能检测MOOV atom位置...");

      // 第一步：下载文件头部进行box结构解析
      // 大多数MP4的moov在前1MB或末尾，先下载前512KB进行精确解析
      const initialScanSize = Math.min(fileSize, 512 * 1024); // 512KB
      console.log(`📥 下载前${Math.round(initialScanSize/1024)}KB进行box结构解析...`);

      const headerResponse = await fetch(videoUrl, {
        headers: {
          'Range': `bytes=0-${initialScanSize - 1}`
        }
      });

      if (!headerResponse.ok && headerResponse.status !== 206) {
        throw new Error(`获取文件头部失败: ${headerResponse.status}`);
      }

      const headerBuffer = Buffer.from(await headerResponse.arrayBuffer());

      // 使用box结构解析来精确定位moov
      const moovInfo = parseMoovLocation(headerBuffer);

      let downloadStrategy;
      let videoBuffer;

      if (moovInfo) {
        // 在文件开头找到了moov，计算需要下载的精确大小
        const moovEnd = moovInfo.offset + moovInfo.size;
        const downloadSize = Math.min(fileSize, Math.max(moovEnd, 5 * 1024 * 1024)); // 至少5MB
        console.log(`✅ MOOV在开头(偏移${moovInfo.offset})，下载前${Math.round(downloadSize/1024/1024)}MB...`);

        const videoResponse = await fetch(videoUrl, {
          headers: {
            'Range': `bytes=0-${downloadSize - 1}`
          }
        });

        if (!videoResponse.ok && videoResponse.status !== 206) {
          throw new Error(`视频下载失败: ${videoResponse.status}`);
        }

        videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        downloadStrategy = 'front-only-precise';
      } else {
        // MOOV不在开头：检查文件末尾
        console.log("⏩ MOOV不在前512KB，检查文件末尾...");

        // 下载末尾512KB进行box结构解析
        const tailScanSize = Math.min(fileSize, 512 * 1024);
        console.log(`📥 下载末尾${Math.round(tailScanSize/1024)}KB进行box结构解析...`);

        const tailResponse = await fetch(videoUrl, {
          headers: {
            'Range': `bytes=-${tailScanSize}` // 末尾512KB
          }
        });

        if (!tailResponse.ok && tailResponse.status !== 206) {
          throw new Error(`获取文件尾部失败: ${tailResponse.status}`);
        }

        const tailBuffer = Buffer.from(await tailResponse.arrayBuffer());

        // 解析末尾的box结构
        // 注意：tailBuffer的偏移需要加上实际文件位置
        const tailStartOffset = fileSize - tailScanSize;
        const moovInfoInTail = parseMoovLocation(tailBuffer);

        if (moovInfoInTail) {
          // 在文件末尾找到了moov
          const actualMoovOffset = tailStartOffset + moovInfoInTail.offset;
          console.log(`✅ MOOV在末尾(文件偏移${actualMoovOffset})，下载前部分+MOOV部分...`);

          // 下载前面部分+moov部分
          const frontSize = Math.min(fileSize, 3 * 1024 * 1024); // 前3MB
          const moovEnd = actualMoovOffset + moovInfoInTail.size;
          const tailSize = Math.min(fileSize - actualMoovOffset, moovInfoInTail.size + 1024 * 1024); // moov + 1MB余量

          console.log(`📥 下载前${Math.round(frontSize/1024/1024)}MB + MOOV区域${Math.round(tailSize/1024/1024)}MB...`);

          // 并行下载前部分和moov部分
          const [frontResponse, moovResponse] = await Promise.all([
            fetch(videoUrl, {
              headers: { 'Range': `bytes=0-${frontSize - 1}` }
            }),
            fetch(videoUrl, {
              headers: { 'Range': `bytes=${actualMoovOffset}-${moovEnd}` }
            })
          ]);

          if ((!frontResponse.ok && frontResponse.status !== 206) ||
              (!moovResponse.ok && moovResponse.status !== 206)) {
            throw new Error('下载前部分或MOOV部分失败');
          }

          const frontBuffer = Buffer.from(await frontResponse.arrayBuffer());
          const moovBuffer = Buffer.from(await moovResponse.arrayBuffer());

          // 合并前部分和moov部分
          videoBuffer = Buffer.concat([frontBuffer, moovBuffer]);
          downloadStrategy = 'front-and-tail-precise';
        } else {
          // 前后512KB都未找到MOOV atom
          console.log(`⚠️  前后各512KB都未找到MOOV atom`);

          if (fileSize < 200 * 1024 * 1024) {
            // 小于200MB的文件，直接下载完整文件
            console.log(`💾 文件大小${Math.round(fileSize/1024/1024)}MB < 200MB，下载完整文件以确保MOOV完整...`);

            const videoResponse = await fetch(videoUrl);
            if (!videoResponse.ok) {
              throw new Error(`完整文件下载失败: ${videoResponse.status}`);
            }

            videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
            downloadStrategy = 'complete-moov-not-found';
          } else {
            // 超大文件（>=200MB）：MOOV可能在中间，采用扩展扫描策略
            console.log(`🔍 超大文件(${Math.round(fileSize/1024/1024)}MB)，扩展扫描范围...`);

            // 下载前2MB进行扫描
            const extendedScanSize = Math.min(fileSize, 2 * 1024 * 1024);
            console.log(`📥 下载前${Math.round(extendedScanSize/1024/1024)}MB进行扩展扫描...`);

            const extendedResponse = await fetch(videoUrl, {
              headers: {
                'Range': `bytes=0-${extendedScanSize - 1}`
              }
            });

            if (!extendedResponse.ok && extendedResponse.status !== 206) {
              throw new Error(`扩展扫描失败: ${extendedResponse.status}`);
            }

            const extendedBuffer = Buffer.from(await extendedResponse.arrayBuffer());
            const moovInExtended = parseMoovLocation(extendedBuffer, extendedScanSize);

            if (moovInExtended) {
              // 在扩展扫描中找到了moov
              const moovEnd = moovInExtended.offset + moovInExtended.size;
              const downloadSize = Math.min(fileSize, Math.max(moovEnd, 10 * 1024 * 1024)); // 至少10MB
              console.log(`✅ 扩展扫描找到MOOV(偏移${moovInExtended.offset})，下载前${Math.round(downloadSize/1024/1024)}MB...`);

              const videoResponse = await fetch(videoUrl, {
                headers: {
                  'Range': `bytes=0-${downloadSize - 1}`
                }
              });

              if (!videoResponse.ok && videoResponse.status !== 206) {
                throw new Error(`视频下载失败: ${videoResponse.status}`);
              }

              videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
              downloadStrategy = 'extended-scan-success';
            } else {
              // 仍未找到MOOV：可能文件损坏或格式异常，尝试下载完整文件
              console.log(`❌ 扩展扫描仍未找到MOOV，下载完整文件作为最后尝试...`);

              const videoResponse = await fetch(videoUrl);
              if (!videoResponse.ok) {
                throw new Error(`完整文件下载失败: ${videoResponse.status}`);
              }

              videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
              downloadStrategy = 'complete-fallback';
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