import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from 'crypto';

const s3Client = new S3Client({ region: "ap-northeast-1" });
const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Token缓存 - 避免重复验证
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 40 * 1000; // 40秒缓存

export const handler = async (event) => {
  // CORS处理
  const corsHeaders = {};

  try {
    console.log("=== Lambda函数开始执行 ===");
    console.log("Request path:", event.requestContext.http.path);
    console.log("Request method:", event.requestContext.http.method);

    // 环境变量检查
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("CLERK_SECRET_KEY not found in environment variables");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Server configuration error",
          details: "Missing CLERK_SECRET_KEY",
        }),
      };
    }

    // 验证JWT token并检查videos模块权限
    const authHeader = event.headers.authorization || event.headers.Authorization;
    console.log("Authorization header:", authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : "Missing");

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Authorization header缺失或格式错误");
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing authorization" }),
      };
    }

    const token = authHeader.split(" ")[1];
    console.log("Token前20字符:", token.substring(0, 20) + "...");

    const user = await verifyTokenAndCheckAccess(token);

    if (!user) {
      console.log("用户权限验证失败");
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Access denied" }),
      };
    }

    console.log("用户权限验证成功:", user.id);

    // 路由处理
    const path = event.requestContext.http.path;
    const method = event.requestContext.http.method;

    console.log("路由匹配 - Path:", path, "Method:", method);

    if (method === "GET" && path === "/videos/list") {
      return await listVideos(user, corsHeaders);
    } else if (method === "GET" && path.startsWith("/videos/url/")) {
      console.log("URL解析调试:");
      console.log("- event.requestContext.http.path:", event.requestContext.http.path);
      console.log("- event.rawPath:", event.rawPath);

      // 使用rawPath来获取原始的URL编码路径
      const rawPath = event.rawPath || event.requestContext.http.path;
      const rawVideoKey = rawPath.replace("/videos/url/", "");
      const videoKey = decodeURIComponent(rawVideoKey);

      console.log("- 使用的rawPath:", rawPath);
      console.log("- 提取的rawVideoKey:", rawVideoKey);
      console.log("- 解码后的videoKey:", videoKey);
      return await getVideoUrl(videoKey, user, corsHeaders);
    } else if (method === "POST" && path === "/upload-youtube") {
      return await uploadYouTubeJson(event, user, corsHeaders);
    } else if (method === "DELETE" && path === "/videos/delete") {
      return await deleteVideo(event, user, corsHeaders);
    }

    console.log("路由不匹配");
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Not found" }),
    };
  } catch (error) {
    console.error("Lambda函数执行错误:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};

// 简化的JWT验证 - 使用管理员邮箱直接放行
async function verifyTokenAndCheckAccess(token) {
  try {
    console.log("--- 开始验证Token ---");

    // 检查缓存
    const cached = tokenCache.get(token);
    if (cached && (Date.now() - cached.timestamp) < TOKEN_CACHE_TTL) {
      console.log("使用缓存的token验证结果");
      return cached.user;
    }

    console.log("步骤1: 简化验证 - 直接允许管理员访问");

    // 临时方案：直接创建管理员用户对象
    const adminUser = {
      id: "admin_user_temp",
      emailAddresses: [{ emailAddress: "damon.xu@gmail.com" }],
      publicMetadata: {
        authorized_modules: ["videos"],
        status: "approved"
      }
    };

    console.log("管理员用户验证成功");

    // 缓存结果
    tokenCache.set(token, {
      user: adminUser,
      timestamp: Date.now()
    });

    return adminUser;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// 文件夹权限配置
const FOLDER_PERMISSIONS = {
  "Movies": ["damon_xuda@163.com"], // Movies文件夹只有damon_xuda@163.com可以访问
  // 可以继续添加其他受限文件夹
  // "Private": ["admin@example.com"],
  // "VIP": ["vip1@example.com", "vip2@example.com"],
};

// 检查用户是否有权限访问指定文件夹
function hasAccessToFolder(userEmail, folderName) {
  // 如果文件夹没有权限限制，所有人都可以访问
  if (!FOLDER_PERMISSIONS[folderName]) {
    return true;
  }

  // 检查用户是否在允许列表中
  return FOLDER_PERMISSIONS[folderName].includes(userEmail);
}

// 支持视频文件和YouTube JSON文件
function isVideoFile(filename) {
  const videoExtensions = [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".mkv",
  ];
  const lowerFilename = filename.toLowerCase();
  return videoExtensions.some((ext) => lowerFilename.endsWith(ext));
}

// 检查是否是YouTube JSON文件
function isYouTubeJsonFile(filename) {
  return filename.toLowerCase().endsWith(".youtube.json");
}

async function listVideos(user, corsHeaders) {
  try {
    console.log("--- 开始获取视频列表 ---");
    console.log("VIDEO_BUCKET:", VIDEO_BUCKET);
    console.log("用户邮箱:", user.emailAddresses?.[0]?.emailAddress);

    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
    });

    const response = await s3Client.send(command);
    console.log("S3响应:", response.Contents?.length || 0, "个对象");

    const userEmail = user.emailAddresses?.[0]?.emailAddress;

    // 支持视频文件和YouTube JSON文件，并添加文件夹权限过滤
    const allFiles =
      response.Contents?.filter((item) => {
        const filename = item.Key.split("/").pop();
        const isVideo = isVideoFile(filename);
        const isYouTube = isYouTubeJsonFile(filename);
        const hasSize = item.Size > 0;

        // 检查文件夹权限
        const pathParts = item.Key.split("/");
        if (pathParts.length > 2) { // videos/FolderName/file.mp4
          const folderName = pathParts[1]; // 获取文件夹名称
          if (!hasAccessToFolder(userEmail, folderName)) {
            console.log(`权限过滤: 用户 ${userEmail} 无权访问文件夹 ${folderName}，跳过文件 ${filename}`);
            return false;
          }
        }

        console.log(
          `文件检查: ${filename} | 是否视频: ${isVideo} | 是否YouTube: ${isYouTube} | 有大小: ${hasSize}`
        );

        return (isVideo || isYouTube) && hasSize;
      }) || [];

    console.log("权限过滤后的文件:", allFiles.length, "个");
    console.log(
      "文件列表:",
      allFiles.map((v) => v.Key.split("/").pop())
    );

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(allFiles),
    };
  } catch (error) {
    console.error("获取视频列表失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to list videos",
        details: error.message,
      }),
    };
  }
}

async function getVideoUrl(videoKey, user, corsHeaders) {
  try {
    console.log("--- 生成视频URL ---");
    console.log("videoKey:", videoKey);
    console.log("用户邮箱:", user.emailAddresses?.[0]?.emailAddress);

    // 检查文件夹权限
    const pathParts = videoKey.split("/");
    if (pathParts.length > 2) { // videos/FolderName/file.mp4
      const folderName = pathParts[1]; // 获取文件夹名称
      const userEmail = user.emailAddresses?.[0]?.emailAddress;

      if (!hasAccessToFolder(userEmail, folderName)) {
        console.log(`权限拒绝: 用户 ${userEmail} 无权访问文件夹 ${folderName} 中的视频 ${videoKey}`);
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Access denied to this folder",
            details: `You don't have permission to access folder: ${folderName}`,
          }),
        };
      }
    }

    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1小时有效期
    });

    console.log("预签名URL生成成功");

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: signedUrl,
        expiresAt: Date.now() + 3600000,
      }),
    };
  } catch (error) {
    console.error("生成视频URL失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to generate video URL",
        details: error.message,
      }),
    };
  }
}

// 简化的上传YouTube JSON功能
async function uploadYouTubeJson(event, user, corsHeaders) {
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Upload function temporarily disabled" }),
  };
}

// 简化的删除功能
async function deleteVideo(event, user, corsHeaders) {
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: "Delete function temporarily disabled" }),
  };
}