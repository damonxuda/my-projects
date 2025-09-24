import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { isAdmin } from "../shared/auth.mjs";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

const BUCKET_NAME = "damonxuda-video-files";

// 判断是否为视频文件
function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// 重命名文件或文件夹
export async function renameItem(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以重命名文件");
    }

    const { oldPath, newPath } = JSON.parse(event.body);

    if (!oldPath || !newPath) {
      return createErrorResponse(400, "缺少必要参数：oldPath 和 newPath");
    }

    // 验证路径必须在videos/目录下
    if (!oldPath.startsWith("videos/") || !newPath.startsWith("videos/")) {
      return createErrorResponse(400, "文件路径必须在videos/目录下");
    }

    // 防止路径遍历攻击
    if (oldPath.includes("..") || newPath.includes("..")) {
      return createErrorResponse(400, "非法路径");
    }

    console.log(`🔄 重命名操作: ${oldPath} -> ${newPath}`);

    // 检查源文件是否存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: oldPath
      }));
    } catch (error) {
      if (error.name === "NotFound") {
        return createErrorResponse(404, "源文件不存在");
      }
      throw error;
    }

    // 检查目标文件是否已存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: newPath
      }));
      return createErrorResponse(409, "目标文件已存在");
    } catch (error) {
      if (error.name !== "NotFound") {
        throw error;
      }
      // 目标文件不存在，可以继续
    }

    // 复制文件到新位置
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${encodeURIComponent(oldPath)}`,
      Key: newPath,
      MetadataDirective: "COPY"
    }));

    // 删除原文件
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: oldPath
    }));

    console.log(`✅ 主文件重命名成功: ${oldPath} -> ${newPath}`);

    // 如果是视频文件，同步重命名缩略图
    let thumbnailRenamed = false;
    let mobileVersionRenamed = false;
    let mobileThumbnailRenamed = false;

    const filename = oldPath.split('/').pop();
    if (isVideoFile(filename)) {
      // 处理主缩略图: videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg
      const oldThumbnailKey = oldPath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');
      const newThumbnailKey = newPath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');

      try {
        // 检查原缩略图是否存在
        await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: oldThumbnailKey,
        }));

        // 复制缩略图到新位置
        await s3Client.send(new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${encodeURIComponent(oldThumbnailKey)}`,
          Key: newThumbnailKey,
          MetadataDirective: "COPY"
        }));

        // 删除原缩略图
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: oldThumbnailKey,
        }));

        thumbnailRenamed = true;
        console.log(`✅ 缩略图重命名成功: ${oldThumbnailKey} -> ${newThumbnailKey}`);
      } catch (thumbnailError) {
        console.log(`⚠️ 缩略图重命名失败或不存在: ${oldThumbnailKey}`, thumbnailError.message);
      }

      // 处理移动端版本: xxx.mp4 -> xxx_mobile.mp4
      if (oldPath.endsWith('.mp4') && !oldPath.includes('_mobile.mp4')) {
        const oldMobileKey = oldPath.replace('.mp4', '_mobile.mp4');
        const newMobileKey = newPath.replace('.mp4', '_mobile.mp4');

        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: oldMobileKey,
          }));

          await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${encodeURIComponent(oldMobileKey)}`,
            Key: newMobileKey,
            MetadataDirective: "COPY"
          }));

          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: oldMobileKey,
          }));

          mobileVersionRenamed = true;
          console.log(`✅ 移动端版本重命名成功: ${oldMobileKey} -> ${newMobileKey}`);

          // 处理移动端缩略图
          const oldMobileThumbnailKey = oldMobileKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');
          const newMobileThumbnailKey = newMobileKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');

          try {
            await s3Client.send(new HeadObjectCommand({
              Bucket: BUCKET_NAME,
              Key: oldMobileThumbnailKey,
            }));

            await s3Client.send(new CopyObjectCommand({
              Bucket: BUCKET_NAME,
              CopySource: `${BUCKET_NAME}/${encodeURIComponent(oldMobileThumbnailKey)}`,
              Key: newMobileThumbnailKey,
              MetadataDirective: "COPY"
            }));

            await s3Client.send(new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: oldMobileThumbnailKey,
            }));

            mobileThumbnailRenamed = true;
            console.log(`✅ 移动端缩略图重命名成功: ${oldMobileThumbnailKey} -> ${newMobileThumbnailKey}`);
          } catch (mobileThumbnailError) {
            console.log(`⚠️ 移动端缩略图重命名失败或不存在: ${oldMobileThumbnailKey}`);
          }
        } catch (mobileError) {
          console.log(`⚠️ 移动端版本重命名失败或不存在: ${oldMobileKey}`, mobileError.message);
        }
      }
    }

    return createSuccessResponse({
      success: true,
      message: "文件重命名成功",
      oldPath,
      newPath,
      thumbnailRenamed,
      mobileVersionRenamed,
      mobileThumbnailRenamed
    });

  } catch (error) {
    console.error("❌ 重命名操作失败:", error);
    return createErrorResponse(500, "重命名操作失败", error.message);
  }
}

// 移动文件（与重命名相同，但语义不同）
export async function moveItem(event, user) {
  return await renameItem(event, user);
}

// 复制文件或文件夹
export async function copyItem(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以复制文件");
    }

    const { sourcePath, targetPath } = JSON.parse(event.body);

    if (!sourcePath || !targetPath) {
      return createErrorResponse(400, "缺少必要参数：sourcePath 和 targetPath");
    }

    // 验证路径必须在videos/目录下
    if (!sourcePath.startsWith("videos/") || !targetPath.startsWith("videos/")) {
      return createErrorResponse(400, "文件路径必须在videos/目录下");
    }

    // 防止路径遍历攻击
    if (sourcePath.includes("..") || targetPath.includes("..")) {
      return createErrorResponse(400, "非法路径");
    }

    console.log(`📋 复制操作: ${sourcePath} -> ${targetPath}`);

    // 检查源文件是否存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: sourcePath
      }));
    } catch (error) {
      if (error.name === "NotFound") {
        return createErrorResponse(404, "源文件不存在");
      }
      throw error;
    }

    // 检查目标文件是否已存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: targetPath
      }));
      return createErrorResponse(409, "目标文件已存在");
    } catch (error) {
      if (error.name !== "NotFound") {
        throw error;
      }
      // 目标文件不存在，可以继续
    }

    // 复制文件到新位置
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${encodeURIComponent(sourcePath)}`,
      Key: targetPath,
      MetadataDirective: "COPY"
    }));

    console.log(`✅ 复制成功: ${sourcePath} -> ${targetPath}`);

    return createSuccessResponse({
      success: true,
      message: "文件复制成功",
      sourcePath,
      targetPath
    });

  } catch (error) {
    console.error("❌ 复制操作失败:", error);
    return createErrorResponse(500, "复制操作失败", error.message);
  }
}

// 创建文件夹
export async function createFolder(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以创建文件夹");
    }

    const { folderPath } = JSON.parse(event.body);

    if (!folderPath) {
      return createErrorResponse(400, "缺少必要参数：folderPath");
    }

    // 确保路径以videos/开头并以/结尾
    let normalizedPath = folderPath;
    if (!normalizedPath.startsWith("videos/")) {
      normalizedPath = "videos/" + normalizedPath;
    }
    if (!normalizedPath.endsWith("/")) {
      normalizedPath += "/";
    }

    // 防止路径遍历攻击
    if (normalizedPath.includes("..")) {
      return createErrorResponse(400, "非法路径");
    }

    console.log(`📁 创建文件夹: ${normalizedPath}`);

    // 检查文件夹是否已存在
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: normalizedPath,
      MaxKeys: 1
    }));

    if (listResponse.Contents && listResponse.Contents.length > 0) {
      return createErrorResponse(409, "文件夹已存在");
    }

    // 创建空的占位符文件来表示文件夹
    const placeholderKey = normalizedPath + ".folder_placeholder";

    // 上传空的占位符对象
    await s3Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/videos/.folder_placeholder`, // 假设根目录有占位符
      Key: placeholderKey,
      MetadataDirective: "REPLACE",
      Metadata: {
        "folder-created": new Date().toISOString(),
        "created-by": user.id || "unknown"
      }
    }));

    console.log(`✅ 文件夹创建成功: ${normalizedPath}`);

    return createSuccessResponse({
      success: true,
      message: "文件夹创建成功",
      folderPath: normalizedPath
    });

  } catch (error) {
    console.error("❌ 创建文件夹失败:", error);
    return createErrorResponse(500, "创建文件夹失败", error.message);
  }
}

// 批量重命名（用于文件夹重命名，需要重命名所有子文件）
export async function batchRename(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以批量重命名");
    }

    const { oldPrefix, newPrefix } = JSON.parse(event.body);

    if (!oldPrefix || !newPrefix) {
      return createErrorResponse(400, "缺少必要参数：oldPrefix 和 newPrefix");
    }

    // 确保前缀以videos/开头
    const normalizedOldPrefix = oldPrefix.startsWith("videos/") ? oldPrefix : "videos/" + oldPrefix;
    const normalizedNewPrefix = newPrefix.startsWith("videos/") ? newPrefix : "videos/" + newPrefix;

    // 防止路径遍历攻击
    if (normalizedOldPrefix.includes("..") || normalizedNewPrefix.includes("..")) {
      return createErrorResponse(400, "非法路径");
    }

    console.log(`🔄 批量重命名: ${normalizedOldPrefix} -> ${normalizedNewPrefix}`);

    // 列出所有需要重命名的文件
    const listResponse = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: normalizedOldPrefix
    }));

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return createErrorResponse(404, "没有找到需要重命名的文件");
    }

    const operations = [];

    // 为每个文件创建重命名操作，包括对应的缩略图
    for (const object of listResponse.Contents) {
      const oldKey = object.Key;
      const newKey = oldKey.replace(normalizedOldPrefix, normalizedNewPrefix);
      const filename = oldKey.split('/').pop();

      operations.push({
        oldKey,
        newKey,
        operation: "rename",
        isVideo: isVideoFile(filename)
      });

      // 如果是视频文件，同时添加缩略图重命名操作
      if (isVideoFile(filename)) {
        const oldThumbnailKey = oldKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');
        const newThumbnailKey = newKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');

        operations.push({
          oldKey: oldThumbnailKey,
          newKey: newThumbnailKey,
          operation: "rename-thumbnail",
          parentVideo: oldKey
        });

        // 如果是mp4文件，处理移动端版本
        if (oldKey.endsWith('.mp4') && !oldKey.includes('_mobile.mp4')) {
          const oldMobileKey = oldKey.replace('.mp4', '_mobile.mp4');
          const newMobileKey = newKey.replace('.mp4', '_mobile.mp4');

          operations.push({
            oldKey: oldMobileKey,
            newKey: newMobileKey,
            operation: "rename-mobile",
            parentVideo: oldKey
          });

          // 移动端缩略图
          const oldMobileThumbnailKey = oldMobileKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');
          const newMobileThumbnailKey = newMobileKey.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');

          operations.push({
            oldKey: oldMobileThumbnailKey,
            newKey: newMobileThumbnailKey,
            operation: "rename-mobile-thumbnail",
            parentVideo: oldKey
          });
        }
      }
    }

    // 执行所有重命名操作
    const results = [];
    for (const op of operations) {
      try {
        // 对于缩略图和移动端文件，先检查是否存在
        if (op.operation.includes('thumbnail') || op.operation.includes('mobile')) {
          try {
            await s3Client.send(new HeadObjectCommand({
              Bucket: BUCKET_NAME,
              Key: op.oldKey
            }));
          } catch (headError) {
            if (headError.name === "NotFound") {
              results.push({
                success: true,
                oldKey: op.oldKey,
                newKey: op.newKey,
                operation: op.operation,
                skipped: true,
                reason: "文件不存在"
              });
              console.log(`⚠️ 跳过不存在的文件: ${op.oldKey}`);
              continue;
            }
            throw headError;
          }
        }

        // 复制到新位置
        await s3Client.send(new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${encodeURIComponent(op.oldKey)}`,
          Key: op.newKey,
          MetadataDirective: "COPY"
        }));

        // 删除原文件
        await s3Client.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: op.oldKey
        }));

        results.push({
          success: true,
          oldKey: op.oldKey,
          newKey: op.newKey,
          operation: op.operation
        });

        console.log(`✅ ${op.operation} 重命名成功: ${op.oldKey} -> ${op.newKey}`);

      } catch (error) {
        console.error(`❌ ${op.operation} 重命名失败: ${op.oldKey}`, error);
        results.push({
          success: false,
          oldKey: op.oldKey,
          newKey: op.newKey,
          operation: op.operation,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const skippedCount = results.filter(r => r.success && r.skipped).length;

    const videoFiles = results.filter(r => r.operation === 'rename').length;
    const thumbnails = results.filter(r => r.operation === 'rename-thumbnail' && r.success).length;
    const mobileVersions = results.filter(r => r.operation === 'rename-mobile' && r.success).length;
    const mobileThumbnails = results.filter(r => r.operation === 'rename-mobile-thumbnail' && r.success).length;

    return createSuccessResponse({
      success: true,
      message: `批量重命名完成: 成功 ${successCount} 个，失败 ${failCount} 个，跳过 ${skippedCount} 个`,
      oldPrefix: normalizedOldPrefix,
      newPrefix: normalizedNewPrefix,
      statistics: {
        videoFiles,
        thumbnails,
        mobileVersions,
        mobileThumbnails
      },
      results: results
    });

  } catch (error) {
    console.error("❌ 批量重命名失败:", error);
    return createErrorResponse(500, "批量重命名失败", error.message);
  }
}