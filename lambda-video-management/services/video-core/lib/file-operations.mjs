import { S3Client, CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { isAdmin } from "../shared/auth.mjs";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

const BUCKET_NAME = "damonxuda-video-files";

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

    console.log(`✅ 重命名成功: ${oldPath} -> ${newPath}`);

    return createSuccessResponse({
      success: true,
      message: "文件重命名成功",
      oldPath,
      newPath
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

    // 为每个文件创建重命名操作
    for (const object of listResponse.Contents) {
      const oldKey = object.Key;
      const newKey = oldKey.replace(normalizedOldPrefix, normalizedNewPrefix);

      operations.push({
        oldKey,
        newKey,
        operation: "rename"
      });
    }

    // 执行所有重命名操作
    const results = [];
    for (const op of operations) {
      try {
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
          newKey: op.newKey
        });

        console.log(`✅ 重命名成功: ${op.oldKey} -> ${op.newKey}`);

      } catch (error) {
        console.error(`❌ 重命名失败: ${op.oldKey}`, error);
        results.push({
          success: false,
          oldKey: op.oldKey,
          newKey: op.newKey,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return createSuccessResponse({
      success: true,
      message: `批量重命名完成: 成功 ${successCount} 个，失败 ${failCount} 个`,
      oldPrefix: normalizedOldPrefix,
      newPrefix: normalizedNewPrefix,
      results: results
    });

  } catch (error) {
    console.error("❌ 批量重命名失败:", error);
    return createErrorResponse(500, "批量重命名失败", error.message);
  }
}