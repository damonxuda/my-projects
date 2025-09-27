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
      // 获取顶级文件夹名称（第一级路径）
      const topLevelFolder = requestedPath.split('/')[0];

      if (!userFolders.includes(topLevelFolder)) {
        console.log(`用户无权访问顶级文件夹: ${topLevelFolder} (请求路径: ${requestedPath})`);
        return createErrorResponse(403, "Access denied to this folder");
      }
    }

    // 分离文件和文件夹
    const files = [];
    const folders = new Set();

    response.Contents.forEach(obj => {
      const key = obj.Key;

      // 跳过根videos/目录标记
      if (key === "videos/" || key.endsWith("/")) return;

      const relativePath = key.replace("videos/", "");
      const pathParts = relativePath.split("/");

      // 处理占位符文件 - 识别为文件夹
      if (key.endsWith(".folder_placeholder")) {
        const folderPath = key.replace("/.folder_placeholder", "").replace("videos/", "");
        if (folderPath) {
          const folderParts = folderPath.split("/");
          // 如果请求特定路径，只显示该路径下的直接子文件夹
          if (requestedPath) {
            if (folderParts.length === requestedPath.split("/").length + 1 &&
                folderPath.startsWith(requestedPath + "/")) {
              const folderName = folderParts[folderParts.length - 1];
              if (userFolders.includes(folderParts[0])) {
                folders.add(folderName);
              }
            }
          } else {
            // 根目录，只显示顶级文件夹
            if (folderParts.length === 1 && userFolders.includes(folderParts[0])) {
              folders.add(folderParts[0]);
            }
          }
        }
        return;
      }

      // 处理普通文件
      // 如果请求特定路径，只返回该路径下的直接文件
      if (requestedPath) {
        // 检查文件是否在请求的路径下
        if (relativePath.startsWith(requestedPath + "/")) {
          // 获取请求路径后的剩余部分
          const pathAfterRequested = relativePath.substring(requestedPath.length + 1);
          const remainingParts = pathAfterRequested.split("/");

          // 只处理直接在请求路径下的文件（不是子文件夹中的文件）
          if (remainingParts.length === 1) {
            const fileName = remainingParts[0];
            const isVideo = /\.(mp4|avi|mov|wmv|mkv)$/i.test(fileName);
            if (isVideo) {
              files.push({
                Key: obj.Key,
                Size: obj.Size,
                LastModified: obj.LastModified,
                ETag: obj.ETag,
                Type: "file"
              });
            }
          }
        }
        return;
      }

      // 如果请求根目录，检查文件权限
      if (pathParts.length === 1) {
        files.push({
          Key: obj.Key,
          Size: obj.Size,
          LastModified: obj.LastModified,
          ETag: obj.ETag,
          Type: "file"
        });
        return;
      }

      // 如果文件在子文件夹中，检查文件夹权限
      const videoFolder = pathParts[0];
      if (userFolders.includes(videoFolder)) {
        files.push({
          Key: obj.Key,
          Size: obj.Size,
          LastModified: obj.LastModified,
          ETag: obj.ETag,
          Type: "file"
        });
        // 同时记录文件夹
        if (!requestedPath) {
          folders.add(videoFolder);
        }
      }
    });

    // 合并文件夹和文件列表
    const folderList = Array.from(folders).map(folderName => ({
      Key: requestedPath ? `videos/${requestedPath}/${folderName}/` : `videos/${folderName}/`,
      Size: 0,
      LastModified: new Date(),
      Type: "folder",
      Name: folderName
    }));

    const allItems = [...folderList, ...files];

    console.log("过滤后的项目数量:", allItems.length, "文件夹:", folderList.length, "文件:", files.length);

    return createSuccessResponse(allItems);

  } catch (error) {
    console.error("获取视频列表失败:", error);
    return createErrorResponse(500, "Failed to list videos", error.message);
  }
}