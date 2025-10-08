import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { getUserAccessibleFolders } from "../shared/auth.mjs";

export async function listYouTubeFiles(event, user) {
  try {
    console.log("=== 获取YouTube文件列表 ===");

    // 获取用户可访问的文件夹
    const userFolders = await getUserAccessibleFolders(user);

    // 检查用户是否有权访问YouTube文件夹
    if (!userFolders.includes("YouTube")) {
      return createSuccessResponse([]);
    }

    // 固定列出videos/YouTube/目录下的所有.youtube.json文件
    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/YouTube/",
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    console.log("S3响应 - Objects数量:", response.Contents?.length || 0);

    if (!response.Contents) {
      return createSuccessResponse([]);
    }

    // 过滤出.youtube.json文件
    const youtubeFiles = response.Contents
      .filter(obj => {
        const key = obj.Key;
        // 跳过目录标记和占位符文件
        if (key.endsWith("/") || key.endsWith(".folder_placeholder")) return false;
        // 只返回.youtube.json文件
        return key.endsWith('.youtube.json');
      })
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.split('/').pop(),
        size: obj.Size,
        lastModified: obj.LastModified,
        type: 'youtube'
      }));

    console.log("YouTube文件数量:", youtubeFiles.length);

    return createSuccessResponse(youtubeFiles);

  } catch (error) {
    console.error("获取YouTube文件列表失败:", error);
    return createErrorResponse(500, "Failed to list YouTube files", error.message);
  }
}