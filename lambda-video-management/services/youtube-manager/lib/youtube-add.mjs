import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { isAdmin } from "../shared/auth.mjs";

export async function addYouTubeFile(event, user) {
  try {
    console.log("=== 添加YouTube文件 ===");

    // 只有管理员可以添加YouTube文件
    if (!isAdmin(user)) {
      return createErrorResponse(403, "Admin access required", "只有管理员可以添加YouTube文件");
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { fileName, content } = body;

    if (!fileName || !content) {
      return createErrorResponse(400, "Missing required parameters: fileName and content");
    }

    // 验证文件名必须是.youtube.json结尾
    if (!fileName.endsWith('.youtube.json')) {
      return createErrorResponse(400, "Invalid file name - must end with .youtube.json");
    }

    // 构建完整路径
    const fullPath = `videos/YouTube/${fileName}`;

    console.log("准备上传YouTube文件:", fullPath);

    // 直接上传JSON内容到S3
    const putCommand = new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: fullPath,
      Body: typeof content === 'string' ? content : JSON.stringify(content),
      ContentType: 'application/json',
      Metadata: {
        'uploaded-by': user.id || 'unknown',
        'upload-date': new Date().toISOString(),
        'source': 'youtube-manager'
      }
    });

    await s3Client.send(putCommand);

    console.log("✅ YouTube文件上传成功:", fullPath);

    return createSuccessResponse({
      success: true,
      message: "YouTube文件添加成功",
      filePath: fullPath,
      fileName: fileName
    });

  } catch (error) {
    console.error("添加YouTube文件失败:", error);
    return createErrorResponse(500, "Failed to add YouTube file", error.message);
  }
}