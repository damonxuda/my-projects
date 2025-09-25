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
    if (!box || box.size <= 0) break;

    console.log(`📦 前端box: type=${box.type}, size=${box.size}, offset=${offset}`);

    if (box.type === 'moov') {
      console.log(`✅ 在前端找到MOOV box，位置: ${offset}, 大小: ${box.size}`);
      return { offset, size: box.size, location: 'front' };
    }

    // 使用box的size字段跳转到下一个box
    offset += box.size;

    // 防止死循环 - 如果偏移超出缓冲区范围则停止
    if (offset >= headerBuffer.length) break;
  }

  // 如果前端没找到，检查大mdat box后面的位置
  console.log('前端未找到MOOV，查找大mdat后面的MOOV...');

  // 从前面的解析中，找到最大的box（通常是mdat）
  offset = 0;
  let largestBox = null;
  const headerBuffer2 = await readBytesFromS3(videoKey, 0, Math.min(fileSize, 256 * 1024) - 1);

  while (offset < headerBuffer2.length - 8) {
    const box = parseBoxHeader(headerBuffer2, offset);
    if (!box || box.size <= 0) break;

    if (!largestBox || box.size > largestBox.size) {
      largestBox = { ...box, offset };
    }

    offset += box.size;
    if (offset >= headerBuffer2.length) break;
  }

  if (largestBox && largestBox.type === 'mdat') {
    // 在mdat后面查找moov
    const afterMdatOffset = largestBox.offset + largestBox.size;
    console.log(`🔍 在mdat后面查找MOOV，起始位置: ${(afterMdatOffset / 1024 / 1024).toFixed(1)}MB`);

    if (afterMdatOffset < fileSize) {
      const searchSize = Math.min(1024 * 1024, fileSize - afterMdatOffset); // 搜索1MB
      const searchBuffer = await readBytesFromS3(videoKey, afterMdatOffset, afterMdatOffset + searchSize - 1);

      offset = 0;
      while (offset < searchBuffer.length - 8) {
        const box = parseBoxHeader(searchBuffer, offset);
        if (!box || box.size <= 0) break;

        console.log(`📦 mdat后box: type=${box.type}, size=${box.size}, offset=${afterMdatOffset + offset}`);

        if (box.type === 'moov') {
          const actualOffset = afterMdatOffset + offset;
          console.log(`✅ 在mdat后找到MOOV box，位置: ${actualOffset}, 大小: ${box.size}`);
          return { offset: actualOffset, size: box.size, location: 'after_mdat' };
        }

        offset += box.size;
        if (offset >= searchBuffer.length) break;
      }
    }
  }

  // 最后检查文件末尾1MB
  console.log('mdat后未找到MOOV，检查文件末尾...');
  const tailSize = Math.min(fileSize, 1024 * 1024);
  const tailStart = fileSize - tailSize;
  const tailBuffer = await readBytesFromS3(videoKey, tailStart, fileSize - 1);

  offset = 0;
  while (offset < tailBuffer.length - 8) {
    const box = parseBoxHeader(tailBuffer, offset);
    if (!box || box.size <= 0) break;

    console.log(`📦 末尾box: type=${box.type}, size=${box.size}, offset=${tailStart + offset}`);

    if (box.type === 'moov') {
      const actualOffset = tailStart + offset;
      console.log(`✅ 在末尾找到MOOV box，位置: ${actualOffset}, 大小: ${box.size}`);
      return { offset: actualOffset, size: box.size, location: 'end' };
    }

    // 使用box的size字段跳转到下一个box
    offset += box.size;

    // 防止死循环
    if (offset >= tailBuffer.length) break;
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
    const rawMdatData = await readBytesFromS3(videoKey, mdatInfo.offset, mdatInfo.offset + mdatSampleSize - 1);

    // 5. 重构正确的MP4文件
    // 创建新的mdat box头部，使其大小匹配实际数据
    const newMdatSize = rawMdatData.length + 8; // +8 for box header
    const newMdatHeader = Buffer.alloc(8);
    newMdatHeader.writeUInt32BE(newMdatSize, 0);  // size
    newMdatHeader.write('mdat', 4);               // type

    const minimalMp4 = Buffer.concat([
      ftypData.length > 0 ? ftypData : Buffer.alloc(0),
      moovData,
      newMdatHeader,  // 新的正确大小的mdat头部
      rawMdatData     // mdat数据内容
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

    // 设置临时文件路径（只需要缩略图输出路径）
    const tempDir = "/tmp";
    const thumbnailPath = path.join(tempDir, `smart_thumbnail_${Date.now()}.jpg`);

    try {
      // 使用真正的MOOV智能算法
      console.log("🚀 使用MOOV智能算法生成缩略图...");

      // 创建最小的可播放MP4文件（只有几MB）
      const minimalMp4 = await createMinimalMp4ForThumbnail(videoKey, fileSize);

      // 将最小MP4写入临时文件
      const tempVideoPath = path.join(tempDir, `minimal_video_${Date.now()}.mp4`);
      writeFileSync(tempVideoPath, minimalMp4);

      console.log(`📦 创建最小MP4文件: ${(minimalMp4.length / 1024).toFixed(1)}KB (vs 原文件 ${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

      // 使用ffmpeg生成缩略图 - 直接从S3 URL读取
      // 检查多个可能的ffmpeg路径
      const possiblePaths = ["/opt/bin/ffmpeg", "/opt/ffmpeg/ffmpeg", "/usr/bin/ffmpeg"];
      let ffmpegPath = "/opt/bin/ffmpeg";

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          ffmpegPath = path;
          console.log(`✅ 找到ffmpeg: ${path}`);
          break;
        }
      }
      console.log(`🔧 使用ffmpeg路径: ${ffmpegPath}`);

      await new Promise((resolve, reject) => {
        // 30秒超时保护
        const timeout = setTimeout(() => {
          ffmpeg.kill('SIGKILL');
          reject(new Error('ffmpeg执行超时(30秒)'));
        }, 30000);

        const ffmpeg = spawn(ffmpegPath, [
          "-loglevel", "info",  // 增加日志详细度
          "-i", tempVideoPath,  // 使用本地最小MP4文件
          "-ss", "00:00:02",  // 跳到第2秒（避免黑屏和初始化问题）
          "-vf", "scale=320:240",
          "-frames:v", "1",
          "-f", "image2",
          "-threads", "2",  // 增加线程数
          "-preset", "ultrafast",
          "-y",
          thumbnailPath
        ]);

        let stderr = "";
        let stdout = "";

        ffmpeg.stdout.on("data", (data) => {
          const output = data.toString();
          stdout += output;
          console.log("ffmpeg stdout:", output);
        });

        ffmpeg.stderr.on("data", (data) => {
          const output = data.toString();
          stderr += output;
          console.log("ffmpeg stderr:", output);
        });

        ffmpeg.on("close", (code) => {
          clearTimeout(timeout);
          console.log("ffmpeg退出码:", code);
          console.log("ffmpeg标准输出长度:", stdout.length);
          console.log("ffmpeg错误输出长度:", stderr.length);

          if (code === 0 && existsSync(thumbnailPath)) {
            console.log("✅ 智能缩略图生成成功");
            resolve();
          } else {
            console.error("ffmpeg执行失败:");
            console.error("退出码:", code);
            console.error("stderr:", stderr.substring(0, 1000)); // 限制输出长度
            reject(new Error(`ffmpeg失败: code ${code}, stderr: ${stderr.substring(0, 500)}`));
          }
        });

        ffmpeg.on("error", (error) => {
          clearTimeout(timeout);
          console.error("ffmpeg进程错误:", error);
          reject(new Error(`ffmpeg进程启动失败: ${error.message}`));
        });

        // 检查ffmpeg进程是否成功启动
        setTimeout(() => {
          if (ffmpeg.pid) {
            console.log(`✅ ffmpeg进程启动成功，PID: ${ffmpeg.pid}`);
          } else {
            console.error("❌ ffmpeg进程启动失败");
          }
        }, 1000);
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
        if (existsSync(thumbnailPath)) unlinkSync(thumbnailPath);
        if (existsSync(tempVideoPath)) unlinkSync(tempVideoPath);
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