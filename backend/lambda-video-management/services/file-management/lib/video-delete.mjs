import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

export async function deleteVideo(event, user) {
  try {
    console.log("--- 开始删除视频文件 ---");

    // 解析请求体
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      console.error("JSON解析失败:", parseError);
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { key } = body;

    // 验证参数
    if (!key) {
      return createErrorResponse(400, "Missing required parameters", "key is required");
    }

    // 安全检查：确保只能删除videos/目录下的文件
    if (!key.startsWith("videos/")) {
      return createErrorResponse(400, "Invalid file path", "Only files in videos/ directory can be deleted");
    }

    console.log("准备删除文件:", key);

    // 检查文件是否存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: key,
      }));
    } catch (headError) {
      if (headError.name === "NotFound") {
        return createErrorResponse(404, "File not found");
      }
      throw headError;
    }

    // 删除主文件
    await s3Client.send(new DeleteObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
    }));

    console.log("主文件删除成功:", key);

    // 尝试删除对应的缩略图 (如果存在)
    // videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg
    let thumbnailDeleted = false;
    let smartThumbnailsDeleted = 0;
    if (key.startsWith('videos/') && /\.(mp4|avi|mov|wmv|mkv)$/i.test(key)) {
      const relativePath = key.replace('videos/', '');
      const thumbnailKey = `thumbnails/${relativePath.replace(/\.[^.]+$/, '.jpg')}`;

      // 删除主缩略图
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
        }));
        console.log("缩略图删除成功:", thumbnailKey);
        thumbnailDeleted = true;
      } catch (thumbnailError) {
        // 缩略图可能不存在，这是正常的
        console.log("缩略图删除失败或不存在:", thumbnailKey, thumbnailError.message);
      }

      // 删除Smart Frame缩略图文件夹: thumbnails/Movies/xxx/
      const smartThumbnailPrefix = `thumbnails/${relativePath.replace(/\.[^.]+$/, '/')}`;
      try {
        console.log("🖼️ 尝试删除Smart Frame缩略图:", smartThumbnailPrefix);

        // 列出所有Smart Frame缩略图文件
        const smartFrameList = await s3Client.send(new ListObjectsV2Command({
          Bucket: VIDEO_BUCKET,
          Prefix: smartThumbnailPrefix,
          MaxKeys: 1000
        }));

        if (smartFrameList.Contents && smartFrameList.Contents.length > 0) {
          // 删除所有Smart Frame缩略图文件
          for (const obj of smartFrameList.Contents) {
            try {
              await s3Client.send(new DeleteObjectCommand({
                Bucket: VIDEO_BUCKET,
                Key: obj.Key,
              }));
              smartThumbnailsDeleted++;
            } catch (deleteError) {
              console.error(`⚠️ 删除Smart Frame缩略图失败: ${obj.Key}`, deleteError.message);
            }
          }
          console.log(`✅ Smart Frame缩略图删除成功: ${smartThumbnailsDeleted} 个文件`);
        } else {
          console.log(`ℹ️ Smart Frame缩略图不存在，跳过: ${smartThumbnailPrefix}`);
        }
      } catch (smartError) {
        console.error(`⚠️ Smart Frame缩略图删除失败: ${smartError.message}`);
      }
    }

    // 注意：原文件和_mobile.mp4现在是独立管理的
    // 删除原文件不会自动删除_mobile.mp4（用户可能想保留优化版本）
    // 删除_mobile.mp4不会自动删除原文件（用户可能想保留原始版本）
    // 如果需要清理重复文件，应该通过批量清理脚本处理
    let assocMobileVersionDeleted = false;

    console.log("ℹ️  文件删除完成。原文件和_mobile.mp4现在独立管理，不会级联删除。");

    return createSuccessResponse({
      message: "File deleted successfully",
      deletedKey: key,
      thumbnailDeleted,
      smartThumbnailsDeleted,
      assocMobileVersionDeleted
    });

  } catch (error) {
    console.error("删除文件失败:", error);
    return createErrorResponse(500, "Failed to delete file", error.message);
  }
}