import { HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { spawn } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";

/**
 * 从S3读取指定范围的字节
 */
async function readBytesFromS3(videoKey, start, end) {
  const videoUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: videoKey }),
    { expiresIn: 3600 }
  );

  const response = await fetch(videoUrl, {
    headers: { 'Range': `bytes=${start}-${end}` }
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`读取字节范围失败: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * 解析MP4 Box头部
 */
function parseBoxHeader(buffer, offset) {
  if (buffer.length < offset + 8) return null;

  const size = buffer.readUInt32BE(offset);
  const type = buffer.slice(offset + 4, offset + 8).toString('ascii');

  let actualSize = size;
  let headerSize = 8;

  if (size === 1) {
    // 64位大小
    if (buffer.length < offset + 16) return null;
    const sizeHigh = buffer.readUInt32BE(offset + 8);
    const sizeLow = buffer.readUInt32BE(offset + 12);
    actualSize = sizeHigh * 0x100000000 + sizeLow;
    headerSize = 16;
  }

  return { size: actualSize, type, headerSize };
}

/**
 * 智能查找MOOV box位置
 */
async function findMoovBoxPosition(videoKey, fileSize) {
  console.log('🔍 智能查找MOOV box位置...');

  // 先检查前64KB（大部分MOOV在这里）
  const headerSize = Math.min(fileSize, 64 * 1024);
  const headerBuffer = await readBytesFromS3(videoKey, 0, headerSize - 1);

  let offset = 0;
  while (offset < headerBuffer.length - 8) {
    const box = parseBoxHeader(headerBuffer, offset);
    if (!box) break;

    if (box.type === 'moov') {
      console.log(`✅ 在前端找到MOOV box，位置: ${offset}, 大小: ${box.size}`);
      return { offset, size: box.size, location: 'front' };
    }

    offset += box.size;
  }

  // 如果前端没找到，检查末尾1MB
  console.log('前端未找到MOOV，检查文件末尾...');
  const tailSize = Math.min(fileSize, 1024 * 1024);
  const tailStart = fileSize - tailSize;
  const tailBuffer = await readBytesFromS3(videoKey, tailStart, fileSize - 1);

  offset = 0;
  while (offset < tailBuffer.length - 8) {
    const box = parseBoxHeader(tailBuffer, offset);
    if (!box) break;

    if (box.type === 'moov') {
      const actualOffset = tailStart + offset;
      console.log(`✅ 在末尾找到MOOV box，位置: ${actualOffset}, 大小: ${box.size}`);
      return { offset: actualOffset, size: box.size, location: 'end' };
    }

    offset += box.size;
  }

  throw new Error('未找到MOOV box');
}

/**
 * 查找第一个mdat box的位置
 */
async function findFirstMdatBox(videoKey, fileSize, moovInfo) {
  console.log('🎬 查找第一个mdat box...');

  let searchStart = 0;
  let searchEnd = Math.min(fileSize, 1024 * 1024); // 搜索前1MB

  // 如果MOOV在前端，从MOOV之后开始搜索
  if (moovInfo.location === 'front') {
    searchStart = moovInfo.offset + moovInfo.size;
    searchEnd = Math.min(fileSize, searchStart + 1024 * 1024);
  }

  const searchBuffer = await readBytesFromS3(videoKey, searchStart, searchEnd - 1);

  let offset = 0;
  while (offset < searchBuffer.length - 8) {
    const box = parseBoxHeader(searchBuffer, offset);
    if (!box) break;

    if (box.type === 'mdat') {
      const actualOffset = searchStart + offset;
      console.log(`✅ 找到第一个mdat box，位置: ${actualOffset}, 大小: ${box.size}`);
      return { offset: actualOffset, size: box.size };
    }

    offset += box.size;
  }

  throw new Error('未找到mdat box');
}

/**
 * 创建最小的可播放MP4文件（用于缩略图生成）
 */
async function createMinimalMp4ForThumbnail(videoKey, fileSize) {
  console.log('🎯 创建最小MP4文件用于缩略图生成...');

  try {
    // 1. 找到MOOV box
    const moovInfo = await findMoovBoxPosition(videoKey, fileSize);

    // 2. 下载ftyp box（通常在最开始）
    const ftypBuffer = await readBytesFromS3(videoKey, 0, 32);
    const ftypBox = parseBoxHeader(ftypBuffer, 0);
    let ftypData = Buffer.alloc(0);

    if (ftypBox && ftypBox.type === 'ftyp') {
      console.log(`📦 下载ftyp box (${ftypBox.size} bytes)`);
      ftypData = await readBytesFromS3(videoKey, 0, ftypBox.size - 1);
    }

    // 3. 下载完整的MOOV box
    console.log(`📦 下载MOOV box (${(moovInfo.size / 1024).toFixed(1)}KB)`);
    const moovData = await readBytesFromS3(videoKey, moovInfo.offset, moovInfo.offset + moovInfo.size - 1);

    // 4. 找到并下载第一个mdat的开头部分（包含第一帧）
    const mdatInfo = await findFirstMdatBox(videoKey, fileSize, moovInfo);

    // 只下载mdat的前2MB，这应该包含第一个关键帧
    const mdatSampleSize = Math.min(mdatInfo.size, 2 * 1024 * 1024);
    console.log(`📦 下载mdat前${(mdatSampleSize / 1024).toFixed(1)}KB`);
    const mdatData = await readBytesFromS3(videoKey, mdatInfo.offset, mdatInfo.offset + mdatSampleSize - 1);

    // 5. 组合最小MP4文件
    const minimalMp4 = Buffer.concat([
      ftypData.length > 0 ? ftypData : Buffer.alloc(0),
      moovData,
      mdatData
    ]);

    console.log(`✅ 创建最小MP4成功，大小: ${(minimalMp4.length / 1024).toFixed(1)}KB`);
    console.log(`   节省空间: ${((fileSize - minimalMp4.length) / 1024 / 1024).toFixed(1)}MB → ${(minimalMp4.length / 1024).toFixed(1)}KB (99.9%+ 节省)`);

    return minimalMp4;

  } catch (error) {
    console.error('创建最小MP4失败:', error);
    throw new Error(`智能缩略图算法失败: ${error.message}`);
  }
}

/**
 * 智能生成大文件缩略图
 */
export async function generateSmartThumbnail(videoKey) {
  try {
    console.log("=== 🚀 智能缩略图生成算法 ===");
    console.log("视频文件:", videoKey);

    // 检查视频文件是否存在
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    }));
    const fileSize = headResult.ContentLength;
    console.log(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    // 生成缩略图key
    const thumbnailKey = videoKey
      .replace(/^videos\//, 'thumbnails/')
      .replace(/\.[^/.]+$/, '.jpg');

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
    }

    // 设置临时文件路径
    const tempDir = "/tmp";
    const videoPath = path.join(tempDir, `smart_input_${Date.now()}.mp4`);
    const thumbnailPath = path.join(tempDir, `smart_thumbnail_${Date.now()}.jpg`);

    try {
      // 创建最小MP4文件
      const minimalMp4 = await createMinimalMp4ForThumbnail(videoKey, fileSize);
      writeFileSync(videoPath, minimalMp4);

      console.log("🎬 使用ffmpeg生成缩略图...");

      // 使用ffmpeg生成缩略图
      const ffmpegPath = "/opt/bin/ffmpeg";

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
          "-i", videoPath,
          "-ss", "0",  // 从开头开始（因为我们已经有了第一帧数据）
          "-vf", "scale=320:240",
          "-frames:v", "1",
          "-f", "image2",
          "-threads", "1",
          "-preset", "ultrafast",
          "-avoid_negative_ts", "make_zero",
          "-y",
          thumbnailPath
        ]);

        let stderr = "";

        ffmpeg.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        ffmpeg.on("close", (code) => {
          console.log("ffmpeg退出码:", code);
          if (code === 0 && existsSync(thumbnailPath)) {
            console.log("✅ 智能缩略图生成成功");
            resolve();
          } else {
            console.error("ffmpeg执行失败:", stderr);
            reject(new Error(`ffmpeg失败: code ${code}`));
          }
        });

        ffmpeg.on("error", (error) => {
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
          "generated-from": encodeURIComponent(videoKey),
          "generated-at": new Date().toISOString(),
          "file-size": fileSize.toString(),
          "algorithm": "smart-moov-based"
        }
      }));

      console.log("🎉 智能缩略图上传成功");

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
        cached: false,
        algorithm: "smart-moov-based",
        originalFileSize: fileSize,
        processedDataSize: minimalMp4.length,
        efficiency: `${(((fileSize - minimalMp4.length) / fileSize) * 100).toFixed(2)}% 数据节省`
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
    console.error("智能缩略图生成失败:", error);
    return createErrorResponse(500, "Failed to generate smart thumbnail", error.message);
  }
}