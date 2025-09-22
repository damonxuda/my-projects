import { ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";
import { getUserAccessibleFolders, isAdmin } from "../shared/auth.mjs";

// 判断是否为视频文件
function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// 检查文件夹权限
function hasAccessToFolder(user, folderName) {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim());
  const userEmail = user.emailAddresses?.[0]?.emailAddress;

  // 管理员可以访问所有文件夹
  if (adminEmails.includes(userEmail)) {
    return true;
  }

  // Movies文件夹只有管理员可以访问
  if (folderName === "Movies") {
    return false;
  }

  // 其他文件夹普通用户可以访问
  return true;
}

export async function getBatchThumbnails(pathParam, user) {
  try {
    console.log("=== 开始批量获取缩略图 ===");
    console.log("Path参数:", pathParam);
    console.log("用户邮箱:", user.emailAddresses?.[0]?.emailAddress);

    // 检查文件夹权限
    if (pathParam && !hasAccessToFolder(user, pathParam)) {
      console.log(`权限拒绝: 用户无权访问文件夹 ${pathParam}`);
      return createErrorResponse(403, "Access denied to this folder", `You don't have permission to access folder: ${pathParam}`);
    }

    // 构建S3前缀
    const s3Prefix = pathParam ? `videos/${pathParam}/` : "videos/";
    console.log("S3前缀:", s3Prefix);

    // 获取该路径下的所有视频文件
    const listCommand = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: s3Prefix,
    });

    const response = await s3Client.send(listCommand);
    console.log("S3响应:", response.Contents?.length || 0, "个对象");

    // 过滤出视频文件，并检查文件夹权限
    const videoFiles = response.Contents?.filter((item) => {
      const filename = item.Key.split("/").pop();
      const isVideo = isVideoFile(filename);
      const hasSize = item.Size > 0;

      // 如果没有指定pathParam（查看根目录），需要检查文件夹权限
      if (!pathParam) {
        const pathParts = item.Key.split("/");
        if (pathParts.length > 2) { // videos/FolderName/file.mp4
          const folderName = pathParts[1]; // 获取文件夹名称
          if (!hasAccessToFolder(user, folderName)) {
            console.log(`批量缩略图权限过滤: 用户无权访问文件夹 ${folderName}，跳过文件 ${filename}`);
            return false;
          }
        }
      }

      return isVideo && hasSize;
    }) || [];

    console.log("视频文件:", videoFiles.length, "个");

    // 为每个视频生成缩略图预签名URL
    const thumbnailUrls = {};

    for (const videoFile of videoFiles) {
      const videoKey = videoFile.Key;
      const baseName = videoKey.replace('videos/', '');
      const thumbnailKey = `thumbnails/${baseName.replace(/\.[^.]+$/, '.jpg')}`;

      console.log(`处理: ${videoKey} -> ${thumbnailKey}`);

      // 检查缩略图是否存在且为有效文件
      try {
        const headResult = await s3Client.send(new HeadObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
        }));

        const fileSize = headResult.ContentLength;
        console.log(`${thumbnailKey} 大小: ${fileSize} bytes`);

        // 只有大于300字节的文件才认为是有效缩略图
        if (fileSize > 300) {
          // 生成24小时有效期的预签名URL
          const signedUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: VIDEO_BUCKET,
              Key: thumbnailKey,
            }),
            { expiresIn: 24 * 60 * 60 } // 24小时
          );

          thumbnailUrls[videoKey] = signedUrl;
          console.log(`✅ ${videoKey}: 有效缩略图URL已生成 (${fileSize} bytes)`);
        } else {
          console.log(`⚠️ ${videoKey}: 缩略图文件过小 (${fileSize} bytes)，视为无效`);
          thumbnailUrls[videoKey] = null; // 标记为需要重新生成
        }

      } catch (error) {
        if (error.name === "NotFound") {
          console.log(`❌ ${videoKey}: 缩略图不存在`);
          thumbnailUrls[videoKey] = null; // 标记为需要生成
        } else {
          console.error(`❌ ${videoKey}: 检查缩略图失败:`, error.message);
          thumbnailUrls[videoKey] = null;
        }
      }
    }

    console.log("批量处理完成，生成URL数量:", Object.keys(thumbnailUrls).length);

    return createSuccessResponse({
      success: true,
      path: pathParam,
      thumbnailUrls,
      count: Object.keys(thumbnailUrls).length,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24小时后过期
    });

  } catch (error) {
    console.error("批量获取缩略图失败:", error);
    return createErrorResponse(500, "Failed to get batch thumbnails", error.message);
  }
}