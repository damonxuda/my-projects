import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { isAdmin } from "../shared/auth.mjs";

export async function deleteYouTubeFile(event, user) {
  try {
    console.log("=== 删除YouTube文件 ===");

    // 只有管理员可以删除YouTube文件
    if (!isAdmin(user)) {
      return createErrorResponse(403, "Admin access required", "只有管理员可以删除YouTube文件");
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { key } = body;

    if (!key) {
      return createErrorResponse(400, "Missing required parameter: key");
    }

    // 验证文件路径必须是YouTube文件
    if (!key.startsWith("videos/YouTube/") || !key.endsWith('.youtube.json')) {
      return createErrorResponse(400, "Invalid YouTube file path");
    }

    console.log("准备删除YouTube文件:", key);

    // 检查文件是否存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: key,
      }));
    } catch (headError) {
      if (headError.name === "NotFound") {
        return createErrorResponse(404, "YouTube file not found");
      }
      throw headError;
    }

    // 删除文件
    await s3Client.send(new DeleteObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
    }));

    console.log("✅ YouTube文件删除成功:", key);

    return createSuccessResponse({
      success: true,
      message: "YouTube文件删除成功",
      deletedKey: key
    });

  } catch (error) {
    console.error("删除YouTube文件失败:", error);
    return createErrorResponse(500, "Failed to delete YouTube file", error.message);
  }
}