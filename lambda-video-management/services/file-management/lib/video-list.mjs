import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { getUserAccessibleFolders } from "../shared/auth.mjs";

export async function listVideos(user, requestedPath = "") {
  try {
    console.log("--- 开始获取视频列表 ---");
    console.log("VIDEO_BUCKET:", VIDEO_BUCKET);
    console.log("请求路径:", requestedPath);

    // 获取用户可访问的文件夹
    const userFolders = await getUserAccessibleFolders(user);

    // 构建S3前缀
    const s3Prefix = requestedPath ? `videos/${requestedPath}/` : "videos/";
    console.log("S3前缀:", s3Prefix);

    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: s3Prefix,
      MaxKeys: 1000,
    });

    const response = await s3Client.send(command);
    console.log("S3响应 - Objects数量:", response.Contents?.length || 0);

    if (!response.Contents) {
      return createSuccessResponse([]);
    }

    // 权限检查：如果请求特定文件夹，先检查用户是否有权限访问
    if (requestedPath) {
      if (!userFolders.includes(requestedPath)) {
        console.log(`用户无权访问文件夹: ${requestedPath}`);
        return createErrorResponse(403, "Access denied to this folder");
      }
    }

    // 过滤用户有权限访问的文件
    const allFiles = response.Contents
      .filter(obj => {
        const key = obj.Key;

        // 跳过文件夹标记
        if (key.endsWith("/")) return false;

        const relativePath = key.replace("videos/", "");
        const pathParts = relativePath.split("/");

        // 如果请求特定路径，只返回该路径下的文件
        if (requestedPath) {
          return pathParts.length > 1 && pathParts[0] === requestedPath;
        }

        // 如果请求根目录，检查文件权限
        if (pathParts.length === 1) {
          return true; // 根目录文件对所有用户开放
        }

        // 如果文件在子文件夹中，检查文件夹权限
        const videoFolder = pathParts[0];
        return userFolders.includes(videoFolder);
      })
      .map(obj => ({
        Key: obj.Key,
        Size: obj.Size,
        LastModified: obj.LastModified,
        ETag: obj.ETag
      }));

    console.log("过滤后的文件数量:", allFiles.length);

    return createSuccessResponse(allFiles);

  } catch (error) {
    console.error("获取视频列表失败:", error);
    return createErrorResponse(500, "Failed to list videos", error.message);
  }
}