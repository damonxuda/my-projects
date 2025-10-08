import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { isAdmin } from "../shared/auth.mjs";

export async function generateUploadUrl(event, user) {
  try {
    console.log("=== 生成上传URL ===");

    // 只有管理员可以上传视频
    if (!isAdmin(user)) {
      return createErrorResponse(403, "Admin access required", "只有管理员可以上传视频");
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { fileName, fileType, fileSize } = body;

    if (!fileName) {
      return createErrorResponse(400, "Missing required parameter: fileName");
    }

    // 验证文件路径安全性
    if (!fileName.startsWith("videos/")) {
      return createErrorResponse(400, "Invalid file path - must be in videos/ directory");
    }

    // 验证文件类型
    const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'];
    if (fileType && !validTypes.includes(fileType)) {
      return createErrorResponse(400, "Invalid file type", "只支持 MP4, AVI, MOV, MKV, WebM 格式");
    }

    // 验证文件大小 (限制为 2GB)
    if (fileSize && fileSize > 2 * 1024 * 1024 * 1024) {
      return createErrorResponse(400, "File too large", "文件大小不能超过 2GB");
    }

    console.log("生成上传URL:", {
      fileName,
      fileType,
      fileSize: fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB` : 'unknown'
    });

    // 创建预签名上传URL
    const putObjectCommand = new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: fileName,
      ContentType: fileType || 'video/mp4',
      Metadata: {
        uploadedBy: user.id,
        originalName: fileName.split('/').pop(),
        uploadTime: new Date().toISOString()
      }
    });

    // 生成预签名URL，有效期15分钟
    const uploadUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 15 * 60 // 15 minutes
    });

    console.log("✅ 上传URL生成成功");

    return createSuccessResponse({
      success: true,
      uploadUrl,
      fileKey: fileName,
      expiresIn: 15 * 60,
      maxFileSize: 2 * 1024 * 1024 * 1024,
      message: "上传URL生成成功，有效期15分钟"
    });

  } catch (error) {
    console.error("生成上传URL失败:", error);
    return createErrorResponse(500, "Failed to generate upload URL", error.message);
  }
}