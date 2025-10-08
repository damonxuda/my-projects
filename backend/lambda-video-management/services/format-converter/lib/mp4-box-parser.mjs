/**
 * 智能MP4 Box解析器
 * 用于精确定位MOOV atom位置，无论它在文件的什么地方
 */

import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * 读取S3文件的指定字节范围
 */
async function readBytes(videoKey, start, end) {
  const command = new GetObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: videoKey,
    Range: `bytes=${start}-${end}`
  });

  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 从Buffer读取32位大端整数
 */
function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

/**
 * 从Buffer读取4字符的box类型
 */
function readBoxType(buffer, offset) {
  return buffer.toString('ascii', offset, offset + 4);
}

/**
 * 解析单个box头部
 */
function parseBoxHeader(buffer, offset = 0) {
  if (buffer.length < offset + 8) {
    return null;
  }

  const size = readUInt32BE(buffer, offset);
  const type = readBoxType(buffer, offset + 4);

  // 处理64位大小的box
  let actualSize = size;
  let headerSize = 8;

  if (size === 1) {
    // 64位大小
    if (buffer.length < offset + 16) {
      return null;
    }
    // JavaScript的Number最大安全整数是2^53-1，对于视频文件足够了
    const sizeHigh = readUInt32BE(buffer, offset + 8);
    const sizeLow = readUInt32BE(buffer, offset + 12);
    actualSize = sizeHigh * 0x100000000 + sizeLow;
    headerSize = 16;
  } else if (size === 0) {
    // box延伸到文件末尾
    actualSize = -1; // 需要文件大小来确定
  }

  return {
    size: actualSize,
    type: type,
    headerSize: headerSize
  };
}

/**
 * 智能查找MOOV box的位置
 * 返回 { found: boolean, offset: number, size: number }
 */
export async function findMoovBox(videoKey, fileSize) {
  console.log(`🔍 开始智能查找MOOV box: ${videoKey}`);
  console.log(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  let offset = 0;
  let boxIndex = 0;
  let foundMdat = false;
  const maxBoxesToScan = 20; // 通常前20个box内就能找到moov

  try {
    while (offset < fileSize && boxIndex < maxBoxesToScan) {
      // 读取box头部（最多16字节应对64位大小）
      const headerBuffer = await readBytes(videoKey, offset, Math.min(offset + 16, fileSize - 1));
      const box = parseBoxHeader(headerBuffer, 0);

      if (!box) {
        console.log(`❌ 无法解析offset ${offset}处的box头部`);
        break;
      }

      // 处理size=0的情况（box延伸到文件末尾）
      if (box.size === -1) {
        box.size = fileSize - offset;
      }

      console.log(`📦 Box #${boxIndex + 1}: type='${box.type}', size=${(box.size / 1024).toFixed(1)}KB, offset=${offset}`);

      // 找到了moov box!
      if (box.type === 'moov') {
        const isMobileCompatible = !foundMdat; // MOOV在mdat之前才兼容
        console.log(`✅ 找到MOOV box! 位置: ${offset}, 大小: ${(box.size / 1024).toFixed(1)}KB`);
        console.log(`📱 移动端兼容性: ${isMobileCompatible ? '兼容(MOOV在mdat之前)' : '不兼容(MOOV在mdat之后)'}`);
        return {
          found: true,
          offset: offset,
          size: box.size,
          isMobileCompatible: isMobileCompatible,
          foundMdatFirst: foundMdat
        };
      }

      // 检查mdat box（关键：如果先遇到mdat，说明MOOV在后面，移动端不兼容）
      if (box.type === 'mdat') {
        foundMdat = true;
        console.log(`⚠️  发现mdat box在MOOV之前 (${(box.size / 1024 / 1024).toFixed(1)}MB) - 移动端可能不兼容`);
      }

      // 移动到下一个box
      offset += box.size;
      boxIndex++;
    }

    console.log(`❌ 扫描了${boxIndex}个box后未找到MOOV`);
    return {
      found: false,
      offset: 0,
      size: 0
    };

  } catch (error) {
    console.error(`❌ 查找MOOV box时出错: ${error.message}`);
    return {
      found: false,
      offset: 0,
      size: 0,
      error: error.message
    };
  }
}

/**
 * 下载MOOV box内容到临时文件
 */
export async function downloadMoovBox(videoKey, moovOffset, moovSize) {
  const fs = await import('fs');
  const path = await import('path');

  // 创建临时文件
  const tempFileName = `moov_${Date.now()}.mp4`;
  const tempFilePath = path.join('/tmp', tempFileName);

  try {
    console.log(`📥 下载MOOV box (${(moovSize / 1024).toFixed(1)}KB) 到 ${tempFilePath}`);

    // 为了让ffprobe能够识别，我们需要创建一个最小的有效MP4文件
    // 包含: ftyp + 只有moov的最小结构

    // 1. 先获取原文件的ftyp box（通常在最开始，很小）
    const ftypBuffer = await readBytes(videoKey, 0, 32);
    const ftypBox = parseBoxHeader(ftypBuffer, 0);

    let ftypData = Buffer.alloc(0);
    if (ftypBox && ftypBox.type === 'ftyp') {
      console.log(`📦 包含ftyp box (${ftypBox.size} bytes)`);
      ftypData = await readBytes(videoKey, 0, ftypBox.size - 1);
    }

    // 2. 下载完整的moov box
    const moovData = await readBytes(videoKey, moovOffset, moovOffset + moovSize - 1);

    // 3. 创建一个空的mdat box（8字节头部，表示没有数据）
    const emptyMdat = Buffer.from([
      0x00, 0x00, 0x00, 0x08,  // size = 8 (只有头部)
      0x6D, 0x64, 0x61, 0x74   // type = 'mdat'
    ]);

    // 4. 组合成最小的有效MP4文件
    const minimalMp4 = Buffer.concat([
      ftypData.length > 0 ? ftypData : Buffer.alloc(0),
      moovData,
      emptyMdat
    ]);

    // 5. 写入临时文件
    fs.writeFileSync(tempFilePath, minimalMp4);
    console.log(`✅ 创建最小MP4文件成功，大小: ${(minimalMp4.length / 1024).toFixed(1)}KB`);

    return tempFilePath;

  } catch (error) {
    console.error(`❌ 下载MOOV box失败: ${error.message}`);
    throw error;
  }
}

/**
 * 智能检测H264 Profile/Level
 * 无论MOOV在文件的什么位置都能找到
 */
export async function smartDetectH264Profile(videoKey, fileSize) {
  console.log("=== 开始智能H264检测 ===");

  try {
    // 1. 智能查找MOOV box位置
    const moovInfo = await findMoovBox(videoKey, fileSize);

    if (!moovInfo.found) {
      return {
        detected: false,
        error: "未找到MOOV box"
      };
    }

    // 2. 下载MOOV box到临时文件
    const tempFilePath = await downloadMoovBox(videoKey, moovInfo.offset, moovInfo.size);

    // 3. 使用ffprobe分析
    const result = await analyzeWithFfprobe(tempFilePath);

    // 4. 添加MOOV位置兼容性信息
    if (result.detected) {
      result.isMobileCompatible = moovInfo.isMobileCompatible;
      result.moovPosition = moovInfo.foundMdatFirst ? 'after_mdat' : 'before_mdat';
      result.moovOffset = moovInfo.offset;
    }

    // 5. 清理临时文件
    const fs = await import('fs');
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`🗑️  清理临时文件: ${tempFilePath}`);
    } catch (e) {
      console.log(`⚠️  清理失败: ${e.message}`);
    }

    return result;

  } catch (error) {
    console.error(`❌ 智能检测失败: ${error.message}`);
    return {
      detected: false,
      error: error.message
    };
  }
}

/**
 * 使用ffprobe分析临时文件
 */
async function analyzeWithFfprobe(filePath) {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const ffprobeCommand = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      filePath
    ];

    console.log(`🎬 执行ffprobe分析: ${filePath}`);
    const ffprobe = spawn('/opt/bin/ffprobe', ffprobeCommand);

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      console.log('⏱️ ffprobe超时，终止进程');
      ffprobe.kill('SIGTERM');
    }, 10000);

    ffprobe.stdout.on('data', (data) => {
      stdout += data;
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data;
    });

    ffprobe.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        console.log(`ffprobe退出码: ${code}`);
        if (stderr) console.log(`错误输出: ${stderr}`);
        resolve({ detected: false, error: `ffprobe failed with code ${code}` });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        if (data.streams && data.streams.length > 0) {
          const videoStream = data.streams[0];

          // 提取profile和level
          const profile = videoStream.profile || 'Unknown';
          const level = videoStream.level || 0;
          const width = videoStream.width || 0;
          const height = videoStream.height || 0;

          console.log(`✅ 成功检测: Profile=${profile}, Level=${level}, 分辨率=${width}x${height}`);

          resolve({
            detected: true,
            profile: profile,
            level: level,
            width: width,
            height: height,
            codec: videoStream.codec_name,
            duration: parseFloat(videoStream.duration || 0),
            bitRate: parseInt(videoStream.bit_rate || 0)
          });
        } else {
          resolve({ detected: false, error: "No video stream found" });
        }
      } catch (parseError) {
        console.log(`解析ffprobe输出失败: ${parseError.message}`);
        resolve({ detected: false, error: parseError.message });
      }
    });

    ffprobe.on('error', (error) => {
      clearTimeout(timeout);
      console.log(`ffprobe执行错误: ${error.message}`);
      resolve({ detected: false, error: error.message });
    });
  });
}