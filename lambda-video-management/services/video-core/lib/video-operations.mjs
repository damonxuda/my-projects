import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { getUserAccessibleFolders } from "../shared/auth.mjs";

export async function listVideos(user) {
  try {
    console.log("--- 开始获取视频列表 ---");
    console.log("VIDEO_BUCKET:", VIDEO_BUCKET);

    // 获取用户可访问的文件夹
    const userFolders = await getUserAccessibleFolders(user);

    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    console.log("S3响应 - Objects数量:", response.Contents?.length || 0);

    if (!response.Contents) {
      return createSuccessResponse([]);
    }

    // 过滤用户有权限访问的文件
    const allFiles = response.Contents
      .filter(obj => {
        const key = obj.Key;

        // 跳过根目录标记
        if (key === "videos/") return false;

        const relativePath = key.replace("videos/", "");
        const pathParts = relativePath.split("/");

        // 如果文件直接在 videos/ 根目录下
        if (pathParts.length === 1) {
          return true; // 根目录文件对所有用户开放
        }

        // 如果文件在子文件夹中，检查文件夹权限
        const videoFolder = pathParts[0];
        return userFolders.includes(videoFolder);
      })
      .map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      }));

    console.log("过滤后的文件数量:", allFiles.length);

    return createSuccessResponse(allFiles);

  } catch (error) {
    console.error("获取视频列表失败:", error);
    return createErrorResponse(500, "Failed to list videos", error.message);
  }
}