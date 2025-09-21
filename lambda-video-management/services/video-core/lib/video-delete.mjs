import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../../shared/s3-config.mjs";

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
    const thumbnailKey = key.replace(/\.[^/.]+$/, "") + "_thumbnail.jpg";
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
      }));
      console.log("缩略图删除成功:", thumbnailKey);
    } catch (thumbnailError) {
      // 缩略图可能不存在，这是正常的
      console.log("缩略图删除失败或不存在:", thumbnailKey, thumbnailError.message);
    }

    // 如果是视频文件，还要尝试删除移动端版本
    if (key.endsWith('.mp4') && !key.includes('_mobile.mp4')) {
      const mobileKey = key.replace('.mp4', '_mobile.mp4');
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: mobileKey,
        }));
        console.log("移动端版本删除成功:", mobileKey);
      } catch (mobileError) {
        console.log("移动端版本删除失败或不存在:", mobileKey, mobileError.message);
      }
    }

    return createSuccessResponse({
      message: "File deleted successfully",
      deletedKey: key,
      thumbnailDeleted: true,
      mobileVersionDeleted: key.endsWith('.mp4') && !key.includes('_mobile.mp4')
    });

  } catch (error) {
    console.error("删除文件失败:", error);
    return createErrorResponse(500, "Failed to delete file", error.message);
  }
}