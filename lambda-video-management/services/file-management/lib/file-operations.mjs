import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
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

    // 如果是视频文件，同步重命名关联文件(缩略图、mobile版本等)
    let thumbnailRenamed = false;
    let assocMobileVersionRenamed = false;
    let assocMobileThumbnailRenamed = false;

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

      // 处理关联的移动端版本: xxx.mp4 -> xxx_mobile.mp4
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

          assocMobileVersionRenamed = true;
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

            assocMobileThumbnailRenamed = true;
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
      assocMobileVersionRenamed,
      assocMobileThumbnailRenamed
    });

  } catch (error) {
    console.error("❌ 重命名操作失败:", error);
    return createErrorResponse(500, "重命名操作失败", error.message);
  }
}

// 移动文件（支持批量移动）
export async function moveItem(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以移动文件");
    }
    // 单个文件移动，直接调用重命名函数实现
    return await renameItem(event, user);
  } catch (error) {
    console.error("❌ 移动操作失败:", error);
    return createErrorResponse(500, "移动操作失败", error.message);
  }
}

// 复制文件或文件夹（支持批量复制）
export async function copyItem(event, user) {
  try {
    if (!isAdmin(user)) {
      return createErrorResponse(403, "只有管理员可以复制文件");
    }

    const body = JSON.parse(event.body);
    const { sourcePath, targetPath } = body;

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

    // 如果是视频文件，同时复制缩略图
    let thumbnailCopied = false;
    let smartThumbnailCopied = false;
    const filename = sourcePath.split('/').pop();
    if (isVideoFile(filename)) {
      try {
        // 处理主缩略图: videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg
        const sourceThumbnailKey = sourcePath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');
        const targetThumbnailKey = targetPath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '.jpg');

        console.log(`🖼️ 尝试复制缩略图: ${sourceThumbnailKey} -> ${targetThumbnailKey}`);

        // 检查源缩略图是否存在
        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: sourceThumbnailKey
          }));

          // 复制缩略图
          await s3Client.send(new CopyObjectCommand({
            Bucket: BUCKET_NAME,
            CopySource: `${BUCKET_NAME}/${encodeURIComponent(sourceThumbnailKey)}`,
            Key: targetThumbnailKey,
            MetadataDirective: "COPY"
          }));

          thumbnailCopied = true;
          console.log(`✅ 缩略图复制成功: ${sourceThumbnailKey} -> ${targetThumbnailKey}`);
        } catch (thumbError) {
          if (thumbError.name === "NotFound") {
            console.log(`ℹ️ 源缩略图不存在，跳过: ${sourceThumbnailKey}`);
          } else {
            console.error(`⚠️ 缩略图复制失败: ${thumbError.message}`);
          }
        }

        // 处理Smart Frame缩略图文件夹: thumbnails/Movies/xxx/ -> thumbnails/Movies/xxx/
        const sourceSmartThumbnailPrefix = sourcePath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '/');
        const targetSmartThumbnailPrefix = targetPath.replace('videos/', 'thumbnails/').replace(/\.[^.]+$/, '/');

        console.log(`🖼️ 尝试复制Smart Frame缩略图: ${sourceSmartThumbnailPrefix} -> ${targetSmartThumbnailPrefix}`);

        // 检查Smart Frame缩略图文件夹是否存在
        try {
          const smartFrameList = await s3Client.send(new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: sourceSmartThumbnailPrefix,
            MaxKeys: 1000
          }));

          if (smartFrameList.Contents && smartFrameList.Contents.length > 0) {
            // 复制所有Smart Frame缩略图文件
            for (const obj of smartFrameList.Contents) {
              const sourceKey = obj.Key;
              const targetKey = sourceKey.replace(sourceSmartThumbnailPrefix, targetSmartThumbnailPrefix);

              await s3Client.send(new CopyObjectCommand({
                Bucket: BUCKET_NAME,
                CopySource: `${BUCKET_NAME}/${encodeURIComponent(sourceKey)}`,
                Key: targetKey,
                MetadataDirective: "COPY"
              }));
            }

            smartThumbnailCopied = true;
            console.log(`✅ Smart Frame缩略图复制成功: ${smartFrameList.Contents.length} 个文件`);
          } else {
            console.log(`ℹ️ 源Smart Frame缩略图不存在，跳过: ${sourceSmartThumbnailPrefix}`);
          }
        } catch (smartError) {
          console.error(`⚠️ Smart Frame缩略图复制失败: ${smartError.message}`);
        }

      } catch (error) {
        console.error(`⚠️ 缩略图复制过程出错: ${error.message}`);
      }
    }

    return createSuccessResponse({
      success: true,
      message: "文件复制成功",
      sourcePath,
      targetPath,
      thumbnailCopied,
      smartThumbnailCopied
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

    // 直接创建空的占位符对象
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: placeholderKey,
      Body: "", // 空文件内容
      ContentType: "text/plain",
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
