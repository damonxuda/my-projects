import { clerkClient } from "@clerk/clerk-sdk-node";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
// MediaConvert导入
import {
  MediaConvertClient,
  CreateJobCommand,
  DescribeEndpointsCommand,
  GetJobCommand,
} from "@aws-sdk/client-mediaconvert";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";


const s3Client = new S3Client({ region: "ap-northeast-1" });
const VIDEO_BUCKET = process.env.AWS_S3_VIDEO_BUCKET_NAME;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// MediaConvert variables
let mediaConvertClient = null;
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN || 'arn:aws:iam::730335478220:role/MediaConvertRole';
const MEDIACONVERT_QUEUE = process.env.MEDIACONVERT_QUEUE || 'Default';
const execAsync = promisify(exec);

// Token缓存 - 避免Clerk API速率限制
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 40 * 1000; // 40秒缓存，与前端45秒保持一致且略短
// 最后同步时间: 2025-09-11 09:15 - 从Lambda云端同步并修改缓存时间

export const handler = async (event) => {
  // CORS处理完全交给Function URL配置
  const corsHeaders = {};

  try {
    console.log("=== Lambda函数开始执行 ===");

    // 检查是否是S3事件（视频上传自动转码）
    if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
      console.log("🔄 处理S3事件: 新视频上传自动转码");
      return await handleS3VideoUploadEvent(event);
    }

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

    // 验证Clerk token并检查videos模块权限
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    console.log(
      "Authorization header:",
      authHeader ? `Bearer ${authHeader.substring(7, 20)}...` : "Missing"
    );

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
    } else if (method === "POST" && path.startsWith("/videos/thumbnail/")) {
      const rawPath = event.rawPath || event.requestContext.http.path;
      const rawVideoKey = rawPath.replace("/videos/thumbnail/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await generateThumbnail(videoKey, corsHeaders);
    } else if (method === "GET" && path === "/videos/thumbnails/batch") {
      const pathParam = event.queryStringParameters?.path || "";
      return await getBatchThumbnails(pathParam, user, corsHeaders);
    } else if (method === "POST" && path.startsWith("/videos/reencode/")) {
      const rawPath = event.rawPath || event.requestContext.http.path;
      const rawVideoKey = rawPath.replace("/videos/reencode/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await reencodeVideo(videoKey, user, corsHeaders);
    } else if (method === "POST" && path === "/videos/reencode/batch") {
      return await batchReencodeVideos(event, user, corsHeaders);
    } else if (method === "POST" && path === "/videos/scan-and-convert") {
      return await scanAndConvertVideos(event, user, corsHeaders);
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

async function verifyTokenAndCheckAccess(token) {
  try {
    console.log("--- 开始验证Token ---");
    
    // 检查缓存
    const cacheKey = token.substring(0, 20) + "..."; // 使用token前20字符作为缓存key的一部分
    const cached = tokenCache.get(token);
    if (cached && (Date.now() - cached.timestamp) < TOKEN_CACHE_TTL) {
      console.log("使用缓存的token验证结果");
      return cached.user;
    }

    console.log("步骤1: 验证token...");
    const sessionToken = await Promise.race([
      clerkClient.verifyToken(token),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Token verification timeout")), 10000)
      ),
    ]);
    console.log("Token验证成功, sessionToken.sub:", sessionToken.sub);

    console.log("步骤2: 获取用户信息...");
    const user = await Promise.race([
      clerkClient.users.getUser(sessionToken.sub),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Get user timeout")), 10000)
      ),
    ]);
    console.log("获取用户成功:", {
      id: user.id,
      emailAddress: user.emailAddresses?.[0]?.emailAddress,
      metadataKeys: Object.keys(user.publicMetadata || {}),
    });

    console.log("步骤3: 检查用户权限...");
    const authorizedModules = user.publicMetadata?.authorized_modules || [];
    const status = user.publicMetadata?.status;

    console.log("用户权限检查:");
    console.log("- authorized_modules:", JSON.stringify(authorizedModules));
    console.log("- status:", status);
    console.log("- 是否包含videos权限:", authorizedModules.includes("videos"));
    console.log("- 状态是否approved:", status === "approved");

    const hasAccess =
      authorizedModules.includes("videos") && status === "approved";

    console.log("最终权限结果:", hasAccess ? "有权限" : "无权限");

    // 如果验证成功，缓存结果
    if (hasAccess) {
      tokenCache.set(token, {
        user: user,
        timestamp: Date.now()
      });
      console.log("Token验证结果已缓存");
    }

    return hasAccess ? user : null;
  } catch (error) {
    console.error("Token verification failed:", error);
    console.error("错误类型:", error.name);
    console.error("错误消息:", error.message);

    if (error.message.includes("timeout")) {
      console.error("请求超时 - 可能需要增加Lambda超时时间");
    }

    return null;
  }
}

// 获取用户有权限访问的文件夹列表
async function getUserAccessibleFolders(user) {
  try {
    // 检查用户是否是管理员
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(email => email.trim());
    const isAdmin = adminEmails.includes(user.emailAddresses?.[0]?.emailAddress);

    // 获取所有文件夹列表
    const listCommand = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
      Delimiter: "/",
      MaxKeys: 100
    });

    const response = await s3Client.send(listCommand);
    const allFolders = [];

    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach(prefix => {
        const folderName = prefix.Prefix.replace("videos/", "").replace("/", "");
        if (folderName) {
          allFolders.push(folderName);
        }
      });
    }

    if (isAdmin) {
      // 管理员可以访问所有文件夹（包括 Movies）
      console.log("管理员用户，可访问所有文件夹:", allFolders);
      return allFolders;
    } else {
      // 普通用户可以访问除 Movies 以外的所有文件夹
      const accessibleFolders = allFolders.filter(folder => folder !== "Movies");
      console.log("普通用户，可访问的文件夹:", accessibleFolders);
      return accessibleFolders;
    }
  } catch (error) {
    console.error("获取用户可访问文件夹失败:", error);
    return []; // 出错时返回空数组，安全起见
  }
}

// 提取YouTube视频ID
function extractVideoId(url) {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 调用YouTube API获取视频信息
async function getYouTubeVideoInfo(videoId) {
  try {
    console.log("--- 调用YouTube API ---");
    console.log("Video ID:", videoId);
    console.log("API Key:", YOUTUBE_API_KEY ? "Present" : "Missing");

    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API Key not configured");
    }

    // 修复：添加contentDetails到part参数以获取duration信息
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`;

    console.log("API URL:", apiUrl.replace(YOUTUBE_API_KEY, "REDACTED"));

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("YouTube API error:", response.status, errorText);
      throw new Error(`YouTube API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(
      "YouTube API response received, items count:",
      data.items?.length || 0
    );

    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found or not accessible");
    }

    const videoData = data.items[0];
    const snippet = videoData.snippet;
    const contentDetails = videoData.contentDetails || {};

    const videoInfo = {
      title: snippet.title,
      description: snippet.description || "",
      channelTitle: snippet.channelTitle,
      publishedAt: snippet.publishedAt,
      thumbnails: snippet.thumbnails,
      duration: contentDetails.duration || "Unknown",
      defaultThumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };

    console.log("Extracted video info:");
    console.log("- Title:", videoInfo.title);
    console.log("- Channel:", videoInfo.channelTitle);
    console.log("- Duration:", videoInfo.duration);
    console.log("- Published:", videoInfo.publishedAt);

    return videoInfo;
  } catch (error) {
    console.error("YouTube API调用失败:", error);

    // 如果API调用失败，返回默认信息
    return {
      title: `YouTube视频_${videoId}`,
      description: "Failed to fetch video details from YouTube API",
      channelTitle: "Unknown",
      publishedAt: new Date().toISOString(),
      thumbnails: {},
      duration: "Unknown",
      defaultThumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      apiError: true,
      errorMessage: error.message,
    };
  }
}

// 清理文件名中的非法字符
function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, "") // 删除Windows不允许的字符
    .replace(/\s+/g, " ") // 多个空格变为单个空格
    .trim()
    .substring(0, 200); // 限制长度
}

// 支持多种视频格式
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

// 获取管理员邮箱列表
function getAdminEmails() {
  const envAdmins = process.env.ADMIN_EMAILS;
  if (envAdmins) {
    return envAdmins.split(',').map(email => email.trim());
  }
  // 如果没有配置环境变量，返回空数组
  console.warn('⚠️ ADMIN_EMAILS 环境变量未配置，无管理员权限');
  return [];
}

// 检查用户是否为管理员
function isAdmin(userEmail) {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(userEmail);
}

// 文件夹权限配置 - 现在支持管理员权限
const FOLDER_PERMISSIONS = {
  "Movies": "admin_only", // Movies文件夹只有管理员可以访问
  // 可以继续添加其他受限文件夹
  // "Private": ["specific@example.com"], // 特定用户
  // "VIP": "admin_only", // 仅管理员
};

// 检查用户是否有权限访问指定文件夹
function hasAccessToFolder(userEmail, folderName) {
  // 如果文件夹没有权限限制，所有人都可以访问
  if (!FOLDER_PERMISSIONS[folderName]) {
    return true;
  }

  const permission = FOLDER_PERMISSIONS[folderName];

  // 如果设置为 "admin_only"，只有管理员可以访问
  if (permission === "admin_only") {
    const hasAdminAccess = isAdmin(userEmail);
    console.log(`管理员权限检查: ${userEmail} -> ${hasAdminAccess ? '是管理员' : '不是管理员'}`);
    return hasAdminAccess;
  }

  // 如果是数组，检查用户是否在允许列表中
  if (Array.isArray(permission)) {
    return permission.includes(userEmail);
  }

  return false;
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

// 上传YouTube JSON文件到S3
async function uploadYouTubeJson(event, user, corsHeaders) {
  try {
    console.log("--- 开始上传YouTube JSON ---");

    // 解析请求体
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error("请求体解析失败:", parseError);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    // 支持两种参数格式：旧版本的{fileName, content, path}和新版本的{content, path}
    const { fileName, content, path } = requestBody;

    console.log("上传参数:");
    console.log("- fileName:", fileName);
    console.log("- path:", path);
    console.log("- content keys:", Object.keys(content || {}));
    console.log("- user:", user.emailAddresses?.[0]?.emailAddress);

    // 验证必需参数
    if (!content || !path) {
      console.error("缺少必需参数");
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing required parameters",
          details: "content and path are required",
        }),
      };
    }

    // 验证YouTube URL并提取视频ID
    if (!content.url) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing YouTube URL in content",
        }),
      };
    }

    const videoId = extractVideoId(content.url);
    if (!videoId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid YouTube URL",
          details: "Could not extract video ID from URL",
        }),
      };
    }

    console.log("提取的视频ID:", videoId);

    // 调用YouTube API获取真实视频信息
    const youtubeInfo = await getYouTubeVideoInfo(videoId);

    // 使用真实标题作为文件名，同时包含videoId用于缩略图
    const sanitizedTitle = sanitizeFileName(youtubeInfo.title);
    const finalFileName = `${sanitizedTitle}_[${videoId}].youtube.json`;

    console.log("最终文件名:", finalFileName);

    // 构建S3键值
    const s3Key = `videos/${path}${finalFileName}`;

    console.log("S3 Key:", s3Key);

    // 创建增强的内容
    const enhancedContent = {
      type: "youtube",
      url: content.url,
      videoId: videoId,
      title: youtubeInfo.title,
      originalTitle: youtubeInfo.title,
      description: youtubeInfo.description,
      channelTitle: youtubeInfo.channelTitle,
      publishedAt: youtubeInfo.publishedAt,
      thumbnails: youtubeInfo.thumbnails,
      defaultThumbnail: youtubeInfo.defaultThumbnail,
      duration: youtubeInfo.duration,

      // 上传者信息
      uploadedBy: user.emailAddresses?.[0]?.emailAddress,
      uploadedAt: new Date().toISOString(),
      uploaderId: user.id,

      // API调用信息
      apiError: youtubeInfo.apiError || false,
      errorMessage: youtubeInfo.errorMessage || null,
    };

    // 上传到S3
    const putCommand = new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(enhancedContent, null, 2),
      ContentType: "application/json",
      Metadata: {
        "uploaded-by": user.id,
        "content-type": "youtube-link",
        "original-url": content.url,
        "video-id": videoId,
        "video-title": sanitizedTitle.substring(0, 100),
        "api-success": (!youtubeInfo.apiError).toString(),
      },
    });

    const result = await s3Client.send(putCommand);

    console.log("YouTube JSON上传成功");
    console.log("S3 upload result:", {
      ETag: result.ETag,
      VersionId: result.VersionId,
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "YouTube video link uploaded successfully",
        s3Key: s3Key,
        fileName: finalFileName,
        videoTitle: youtubeInfo.title,
        channelTitle: youtubeInfo.channelTitle,
        uploadedAt: enhancedContent.uploadedAt,
        apiSuccess: !youtubeInfo.apiError,
        apiError: youtubeInfo.apiError ? youtubeInfo.errorMessage : null,
      }),
    };
  } catch (error) {
    console.error("上传YouTube JSON失败:", error);
    console.error("错误详情:", {
      name: error.name,
      message: error.message,
      code: error.$metadata?.httpStatusCode,
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to upload YouTube JSON",
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

// 删除视频文件
async function deleteVideo(event, user, corsHeaders) {
  try {
    console.log("--- 开始删除视频文件 ---");

    // 解析请求体
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error("请求体解析失败:", parseError);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    const { key } = requestBody;

    console.log("删除参数:");
    console.log("- key:", key);
    console.log("- user:", user.emailAddresses?.[0]?.emailAddress);

    // 验证必需参数
    if (!key) {
      console.error("缺少必需参数");
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing required parameters",
          details: "key is required",
        }),
      };
    }

    // 验证文件路径安全性
    if (!key.startsWith("videos/")) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid file path",
          details: "Only files in videos/ directory can be deleted",
        }),
      };
    }

    // 删除S3对象
    const deleteCommand = new DeleteObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
    });

    const result = await s3Client.send(deleteCommand);

    console.log("文件删除成功");
    console.log("S3 delete result:", {
      DeleteMarker: result.DeleteMarker,
      VersionId: result.VersionId,
    });

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "File deleted successfully",
        key: key,
        deletedAt: new Date().toISOString(),
        deletedBy: user.emailAddresses?.[0]?.emailAddress,
      }),
    };
  } catch (error) {
    console.error("删除文件失败:", error);
    console.error("错误详情:", {
      name: error.name,
      message: error.message,
      code: error.$metadata?.httpStatusCode,
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to delete file",
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

// 生成视频缩略图
async function generateThumbnail(videoKey, corsHeaders) {
  try {
    console.log("=== 开始生成缩略图 ===");
    console.log("视频文件:", videoKey);

    // 检查视频文件是否存在
    const videoExists = await checkVideoExists(videoKey);
    if (!videoExists) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Video file not found" }),
      };
    }

    // 构建缩略图文件名 - 缩略图在thumbnails/目录下
    const videoPath = videoKey;
    // videos/xxx.mp4 -> thumbnails/xxx.jpg
    // videos/Movies/xxx.mp4 -> thumbnails/Movies/xxx.jpg  
    const baseName = videoKey.replace('videos/', '');
    const thumbnailKey = `thumbnails/${baseName.replace(/\.[^.]+$/, '.jpg')}`;
    
    console.log("缩略图路径:", thumbnailKey);

    // 检查缩略图是否已存在
    const thumbnailExists = await checkThumbnailExists(thumbnailKey);
    if (thumbnailExists) {
      console.log("缩略图已存在，返回现有URL");
      const thumbnailUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
        }),
        { expiresIn: 3600 }
      );
      
      const responseBody = JSON.stringify({
        success: true,
        thumbnailUrl,
        cached: true
      });
      
      console.log("响应体大小:", responseBody.length, "字符");
      console.log("缩略图URL长度:", thumbnailUrl.length, "字符");
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: responseBody,
      };
    }

    // 生成新缩略图
    console.log("生成新的缩略图...");
    const thumbnailUrl = await createVideoThumbnail(videoPath, thumbnailKey);
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        thumbnailUrl,
        cached: false
      }),
    };

  } catch (error) {
    console.error("缩略图生成失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to generate thumbnail",
        details: error.message,
      }),
    };
  }
}

// 检查视频文件是否存在
async function checkVideoExists(videoKey) {
  try {
    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey, // videoKey已经包含videos/前缀
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

// 检查缩略图是否存在
async function checkThumbnailExists(thumbnailKey) {
  try {
    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: thumbnailKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

// 创建视频缩略图
async function createVideoThumbnail(videoPath, thumbnailKey) {
  const tempVideoPath = `/tmp/input_video.mp4`;
  const tempThumbnailPath = `/tmp/thumbnail.jpg`;

  try {
    // 智能三层处理策略
    console.log("🤖 启动智能缩略图生成策略...");
    
    // 策略1: HTTP流式处理（快速，免费）
    console.log("📡 策略1: 尝试HTTP流式处理...");
    try {
      const s3VideoUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: videoPath
      }), { expiresIn: 3600 });
      
      const streamCommand = `/opt/bin/ffmpeg -ss 00:00:03 -i "${s3VideoUrl}" -vframes 1 -vf "scale=320:240" -y "${tempThumbnailPath}"`;
      console.log("执行FFmpeg流式命令...");
      
      const { stdout, stderr } = await execAsync(streamCommand);
      console.log("✅ 策略1成功: HTTP流式处理完成");
      if (stderr) console.log("FFmpeg stderr:", stderr);
      
    } catch (streamError) {
      console.log("❌ 策略1失败:", streamError.message);
      console.log("🔄 自动切换到策略2...");
      
      // 策略2: 部分下载FFmpeg（中等速度，免费）
      try {
        console.log("📥 策略2: 尝试部分下载处理...");
        
        // 获取文件大小
        const headResult = await s3Client.send(new HeadObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: videoPath,
        }));
        const fileSize = headResult.ContentLength;
        // 增大下载大小以包含moov atom，对于大文件下载前1GB
        const downloadSize = Math.min(fileSize, 1024 * 1024 * 1024); // 最多1GB
        
        console.log(`下载前${Math.round(downloadSize/1024/1024)}MB进行处理...`);
        
        const videoData = await s3Client.send(new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: videoPath,
          Range: `bytes=0-${downloadSize - 1}`
        }));
        
        const videoBuffer = await streamToBuffer(videoData.Body);
        await writeFile(tempVideoPath, videoBuffer);
        
        const downloadCommand = `/opt/bin/ffmpeg -ss 00:00:03 -i "${tempVideoPath}" -vframes 1 -vf "scale=320:240" -y "${tempThumbnailPath}"`;
        const { stdout: stdout2, stderr: stderr2 } = await execAsync(downloadCommand);
        console.log("✅ 策略2成功: 部分下载处理完成");
        if (stderr2) console.log("FFmpeg stderr:", stderr2);
        
      } catch (downloadError) {
        console.log("❌ 策略2失败:", downloadError.message);
        console.log("🚀 自动切换到策略3: MediaConvert...");
        
        // 策略3: MediaConvert（可靠，小成本）
        return await generateThumbnailWithMediaConvert(videoPath, thumbnailKey);
      }
    }

    // 3. 读取生成的缩略图
    console.log("步骤3: 读取生成的缩略图...");
    const thumbnailBuffer = await readFile(tempThumbnailPath);
    console.log("缩略图文件大小:", thumbnailBuffer.length);

    // 4. 上传缩略图到S3
    console.log("步骤4: 上传缩略图到S3...");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: "image/jpeg",
      })
    );

    // 5. 生成访问URL
    const thumbnailUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
      }),
      { expiresIn: 3600 }
    );

    console.log("缩略图生成成功!");
    return thumbnailUrl;

  } finally {
    // 清理临时文件
    try {
      await unlink(tempThumbnailPath);
      console.log("清理临时缩略图文件");
    } catch (error) {
      console.log("清理临时缩略图文件失败:", error.message);
    }
    
    // 如果使用了部分下载，也清理临时视频文件
    try {
      await unlink(tempVideoPath);
      console.log("清理临时视频文件");
    } catch (error) {
      // 如果文件不存在（HTTP流模式），这是正常的
      console.log("临时视频文件清理（文件可能不存在，这是正常的）");
    }
  }
}

// 批量获取缩略图预签名URLs
async function getBatchThumbnails(pathParam, user, corsHeaders) {
  try {
    console.log("=== 开始批量获取缩略图 ===");
    console.log("Path参数:", pathParam);
    console.log("用户邮箱:", user.emailAddresses?.[0]?.emailAddress);

    // 检查文件夹权限
    if (pathParam) {
      const userEmail = user.emailAddresses?.[0]?.emailAddress;
      if (!hasAccessToFolder(userEmail, pathParam)) {
        console.log(`权限拒绝: 用户 ${userEmail} 无权访问文件夹 ${pathParam}`);
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            error: "Access denied to this folder",
            details: `You don't have permission to access folder: ${pathParam}`,
          }),
        };
      }
    }

    // 构建S3前缀 - 如果有path参数则使用，否则获取根目录
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
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    const videoFiles = response.Contents?.filter((item) => {
      const filename = item.Key.split("/").pop();
      const isVideo = isVideoFile(filename);
      const hasSize = item.Size > 0;

      // 如果没有指定pathParam（查看根目录），需要检查文件夹权限
      if (!pathParam) {
        const pathParts = item.Key.split("/");
        if (pathParts.length > 2) { // videos/FolderName/file.mp4
          const folderName = pathParts[1]; // 获取文件夹名称
          if (!hasAccessToFolder(userEmail, folderName)) {
            console.log(`批量缩略图权限过滤: 用户 ${userEmail} 无权访问文件夹 ${folderName}，跳过文件 ${filename}`);
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
      
      // 检查缩略图是否存在且为有效文件（大于1KB）
      try {
        const headResult = await s3Client.send(new HeadObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: thumbnailKey,
        }));
        
        const fileSize = headResult.ContentLength;
        console.log(`${thumbnailKey} 大小: ${fileSize} bytes`);
        
        // 只有大于300字节的文件才认为是有效缩略图（156字节是无效占位符，940字节白色缩略图是有效的）
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
          console.log(`⚠️ ${videoKey}: 缩略图文件过小 (${fileSize} bytes)，视为无效，标记重新生成`);
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

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        path: pathParam,
        thumbnailUrls,
        count: Object.keys(thumbnailUrls).length,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24小时后过期
      }),
    };

  } catch (error) {
    console.error("批量获取缩略图失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to get batch thumbnails",
        details: error.message,
      }),
    };
  }
}

// 将stream转换为buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// MediaConvert客户端初始化
async function initializeMediaConvertClient() {
  if (mediaConvertClient) {
    return mediaConvertClient;
  }

  try {
    console.log("🔧 初始化MediaConvert客户端...");

    // 先获取MediaConvert端点
    const tempClient = new MediaConvertClient({ region: "ap-northeast-1" });
    const endpointsCommand = new DescribeEndpointsCommand({});
    const endpointsResponse = await tempClient.send(endpointsCommand);

    if (!endpointsResponse.Endpoints || endpointsResponse.Endpoints.length === 0) {
      throw new Error("No MediaConvert endpoints found");
    }

    const endpoint = endpointsResponse.Endpoints[0].Url;
    console.log("MediaConvert端点:", endpoint);

    // 使用端点创建真正的客户端
    mediaConvertClient = new MediaConvertClient({
      region: "ap-northeast-1",
      endpoint: endpoint
    });

    console.log("✅ MediaConvert客户端初始化成功");
    return mediaConvertClient;

  } catch (error) {
    console.error("❌ MediaConvert客户端初始化失败:", error);
    throw error;
  }
}

// 使用MediaConvert生成缩略图（策略3: 终极方案）
async function generateThumbnailWithMediaConvert(videoPath, thumbnailKey) {
  console.log("🎬 MediaConvert暂时不可用，使用默认缩略图");
  console.log("📹 大文件:", videoPath);

  // 暂时返回默认缩略图，避免复杂性导致的不稳定
  return `https://${VIDEO_BUCKET}.s3.ap-northeast-1.amazonaws.com/default-thumbnail.jpg`;
}

// 重编码视频为移动端兼容格式
async function reencodeVideo(videoKey, user, corsHeaders) {
  try {
    console.log("=== 开始重编码视频 ===");
    console.log("原视频文件:", videoKey);
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

    // 检查原视频文件是否存在
    const videoExists = await checkVideoExists(videoKey);
    if (!videoExists) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Video file not found" }),
      };
    }

    // 构建重编码后的文件名
    const pathWithoutExtension = videoKey.replace(/\.[^.]+$/, '');
    const recodedVideoKey = `${pathWithoutExtension}_mobile.mp4`;

    console.log("重编码后文件名:", recodedVideoKey);

    // 检查重编码文件是否已存在
    const recodedExists = await checkVideoExists(recodedVideoKey);
    if (recodedExists) {
      console.log("重编码文件已存在，返回现有URL");
      const recodedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: recodedVideoKey,
        }),
        { expiresIn: 3600 }
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          recodedUrl,
          recodedKey: recodedVideoKey,
          cached: true,
          message: "Video already recoded for mobile compatibility"
        }),
      };
    }

    // 开始重编码处理
    console.log("开始重编码处理...");
    const recodedUrl = await processVideoRecoding(videoKey, recodedVideoKey);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        recodedUrl,
        recodedKey: recodedVideoKey,
        cached: false,
        message: "Video successfully recoded for mobile compatibility"
      }),
    };

  } catch (error) {
    console.error("视频重编码失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to reencode video",
        details: error.message,
      }),
    };
  }
}

// 处理视频重编码
async function processVideoRecoding(originalVideoKey, recodedVideoKey) {
  const tempInputPath = `/tmp/input_video.mp4`;
  const tempOutputPath = `/tmp/output_video.mp4`;

  try {
    console.log("🎬 开始视频重编码处理...");

    // 1. 下载原视频文件
    console.log("步骤1: 下载原视频文件...");
    const videoData = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: originalVideoKey,
    }));

    const videoBuffer = await streamToBuffer(videoData.Body);
    await writeFile(tempInputPath, videoBuffer);
    console.log("原视频文件下载完成，大小:", videoBuffer.length);

    // 2. 使用ffmpeg重编码为移动端兼容格式
    console.log("步骤2: FFmpeg重编码...");
    const ffmpegCommand = [
      `/opt/bin/ffmpeg`,
      `-i "${tempInputPath}"`,
      `-c:v libx264`,                    // H.264视频编码
      `-profile:v baseline`,             // 基线profile，兼容性最好
      `-level 3.0`,                      // Level 3.0，移动端支持
      `-preset fast`,                    // 快速编码预设
      `-crf 23`,                         // 恒定质量因子，23是较好的平衡点
      `-maxrate 1000k`,                  // 最大比特率1Mbps
      `-bufsize 2000k`,                  // 缓冲区大小
      `-c:a aac`,                        // AAC音频编码
      `-ar 44100`,                       // 音频采样率44.1kHz
      `-b:a 128k`,                       // 音频比特率128kbps
      `-ac 2`,                           // 双声道
      `-movflags +faststart`,            // 快速启动，适合流媒体
      `-f mp4`,                          // MP4格式
      `-y "${tempOutputPath}"`           // 覆盖输出文件
    ].join(' ');

    console.log("执行FFmpeg重编码命令...");
    console.log("命令:", ffmpegCommand);

    const { stderr } = await execAsync(ffmpegCommand);
    console.log("✅ FFmpeg重编码完成");
    if (stderr) console.log("FFmpeg stderr:", stderr);

    // 3. 读取重编码后的视频
    console.log("步骤3: 读取重编码后的视频...");
    const recodedBuffer = await readFile(tempOutputPath);
    console.log("重编码视频文件大小:", recodedBuffer.length);

    // 4. 上传重编码视频到S3
    console.log("步骤4: 上传重编码视频到S3...");
    await s3Client.send(
      new PutObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: recodedVideoKey,
        Body: recodedBuffer,
        ContentType: "video/mp4",
        Metadata: {
          "recodedfrom": originalVideoKey.replace(/[^a-zA-Z0-9\-_\.\/]/g, '_'),
          "recodedat": new Date().toISOString().replace(/[^a-zA-Z0-9\-_\.]/g, '_'),
          "mobilecompatible": "true",
          "codec": "h264baseline",
          "audio": "aac"
        }
      })
    );

    // 5. 生成访问URL
    const recodedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: recodedVideoKey,
      }),
      { expiresIn: 3600 }
    );

    console.log("视频重编码成功!");
    return recodedUrl;

  } finally {
    // 清理临时文件
    try {
      await unlink(tempInputPath);
      console.log("清理临时输入文件");
    } catch (error) {
      console.log("清理临时输入文件失败:", error.message);
    }

    try {
      await unlink(tempOutputPath);
      console.log("清理临时输出文件");
    } catch (error) {
      console.log("清理临时输出文件失败:", error.message);
    }
  }
}

// 处理S3视频上传事件（自动转码）
async function handleS3VideoUploadEvent(event) {
  try {
    console.log("🎬 === S3视频上传事件处理 ===");

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log("S3事件详情:");
      console.log("- Bucket:", bucket);
      console.log("- Key:", key);
      console.log("- Event:", record.eventName);

      // 检查是否是视频文件
      if (!isVideoFile(key)) {
        console.log("⏭️ 跳过非视频文件:", key);
        continue;
      }

      // 检查是否已经是移动端版本
      if (key.includes('_mobile.')) {
        console.log("⏭️ 跳过移动端文件:", key);
        continue;
      }

      // 检查是否在videos/目录下
      if (!key.startsWith('videos/')) {
        console.log("⏭️ 跳过非videos目录文件:", key);
        continue;
      }

      console.log("✅ 开始处理视频转码:", key);

      // 启动MediaConvert转码
      const result = await convertVideoWithMediaConvert(key);
      console.log("🎉 转码任务提交成功:", result.jobId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "S3 video upload event processed successfully"
      })
    };

  } catch (error) {
    console.error("❌ S3事件处理失败:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process S3 event",
        details: error.message
      })
    };
  }
}

// 使用MediaConvert转码视频
async function convertVideoWithMediaConvert(videoKey) {
  try {
    console.log("🎬 === MediaConvert视频转码 ===");
    console.log("输入视频:", videoKey);

    // 初始化MediaConvert客户端
    const client = await initializeMediaConvertClient();

    // 生成输出文件名
    const pathWithoutExt = videoKey.substring(0, videoKey.lastIndexOf('.'));
    const extension = videoKey.substring(videoKey.lastIndexOf('.'));
    const outputKey = `${pathWithoutExt}_mobile${extension}`;

    console.log("输出视频:", outputKey);

    // 创建MediaConvert任务配置
    const jobSettings = {
      Role: MEDIACONVERT_ROLE_ARN,
      Queue: MEDIACONVERT_QUEUE,
      Settings: {
        Inputs: [{
          FileInput: `s3://${VIDEO_BUCKET}/${videoKey}`
        }],
        OutputGroups: [{
          Name: "Mobile_MP4",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: `s3://${VIDEO_BUCKET}/${pathWithoutExt}_mobile`
            }
          },
          Outputs: [{
            NameModifier: "",
            VideoDescription: {
              Width: 1280,
              Height: 720,
              CodecSettings: {
                Codec: "H_264",
                H264Settings: {
                  Profile: "BASELINE",
                  Level: "H264_LEVEL_3_1",
                  RateControlMode: "CBR",
                  Bitrate: 1000000,
                  QualityTuningLevel: "SINGLE_PASS",
                  AdaptiveQuantization: "OFF"
                }
              }
            },
            AudioDescriptions: [{
              CodecSettings: {
                Codec: "AAC",
                AacSettings: {
                  Bitrate: 128000,
                  CodingMode: "CODING_MODE_2_0",
                  SampleRate: 44100
                }
              }
            }],
            ContainerSettings: {
              Container: "MP4",
              Mp4Settings: {
                FreeSpaceBox: "EXCLUDE",
                MoovPlacement: "PROGRESSIVE_DOWNLOAD"
              }
            }
          }]
        }]
      }
    };

    console.log("📋 创建MediaConvert任务...");

    // 提交转码任务
    const createJobCommand = new CreateJobCommand(jobSettings);
    const response = await client.send(createJobCommand);

    console.log("✅ MediaConvert任务创建成功:");
    console.log("- Job ID:", response.Job.Id);
    console.log("- Status:", response.Job.Status);

    return {
      jobId: response.Job.Id,
      status: response.Job.Status,
      inputFile: videoKey,
      outputFile: outputKey
    };

  } catch (error) {
    console.error("❌ MediaConvert转码失败:", error);
    throw error;
  }
}

// 批量重编码视频功能
async function batchReencodeVideos(event, user, corsHeaders) {
  try {
    console.log("=== 开始批量重编码视频 ===");

    // 解析请求参数
    let requestBody = {};
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (parseError) {
        console.log("无请求体或解析失败，使用默认参数");
      }
    }

    const {
      folderPath = "", // 指定文件夹路径，空字符串表示所有文件夹
      forceReencode = false, // 是否强制重编码已有_mobile版本的视频
      maxConcurrent = 3, // 最大并发重编码数量
      dryRun = false // 是否只是检测而不实际重编码
    } = requestBody;

    console.log("批量重编码参数:");
    console.log("- 文件夹路径:", folderPath || "所有文件夹");
    console.log("- 强制重编码:", forceReencode);
    console.log("- 最大并发数:", maxConcurrent);
    console.log("- 试运行模式:", dryRun);

    // 获取用户可访问的所有视频文件
    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: folderPath ? `videos/${folderPath}` : "videos/",
    });

    const response = await s3Client.send(command);
    console.log("S3响应:", response.Contents?.length || 0, "个对象");

    // 过滤出需要重编码的视频文件
    const videosToRecode = [];
    const alreadyRecoded = [];
    const accessDenied = [];

    for (const item of response.Contents || []) {
      const filename = item.Key.split("/").pop();
      const fileExtension = filename.toLowerCase();

      // 检查是否是视频文件
      if (!isVideoFile(filename) || item.Size <= 0) {
        continue;
      }

      // 跳过已经是_mobile版本的文件
      if (filename.includes("_mobile.")) {
        continue;
      }

      // 检查文件夹权限
      const pathParts = item.Key.split("/");
      if (pathParts.length > 2) {
        const folderName = pathParts[1];
        if (!hasAccessToFolder(userEmail, folderName)) {
          accessDenied.push(item.Key);
          continue;
        }
      }

      // 检查是否已有移动端版本
      const originalKey = item.Key;
      const pathWithoutExt = originalKey.substring(0, originalKey.lastIndexOf('.'));
      const extension = originalKey.substring(originalKey.lastIndexOf('.'));
      const mobileKey = `${pathWithoutExt}_mobile${extension}`;

      let hasMobileVersion = false;
      try {
        await s3Client.send(new GetObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: mobileKey,
        }));
        hasMobileVersion = true;
        alreadyRecoded.push(originalKey);
      } catch (error) {
        // 移动端版本不存在，需要重编码
      }

      if (!hasMobileVersion || forceReencode) {
        videosToRecode.push({
          originalKey,
          mobileKey,
          size: item.Size,
          lastModified: item.LastModified
        });
      }
    }

    console.log(`📊 批量重编码统计:`);
    console.log(`- 需要重编码: ${videosToRecode.length} 个视频`);
    console.log(`- 已有移动版本: ${alreadyRecoded.length} 个视频`);
    console.log(`- 权限不足: ${accessDenied.length} 个视频`);

    // 如果是试运行模式，返回统计信息
    if (dryRun) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dryRun: true,
          summary: {
            needsReencoding: videosToRecode.length,
            alreadyRecoded: alreadyRecoded.length,
            accessDenied: accessDenied.length,
            totalScanned: response.Contents?.length || 0
          },
          videosToRecode: videosToRecode.map(v => ({
            path: v.originalKey,
            size: v.size,
            lastModified: v.lastModified
          })),
          alreadyRecoded,
          accessDenied
        }),
      };
    }

    // 实际执行批量重编码
    if (videosToRecode.length === 0) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          message: "没有需要重编码的视频",
          summary: {
            needsReencoding: 0,
            alreadyRecoded: alreadyRecoded.length,
            accessDenied: accessDenied.length
          }
        }),
      };
    }

    // 限制Lambda执行时间，批量处理不能超时
    const maxVideosToProcess = Math.min(videosToRecode.length, maxConcurrent);
    const videosToProcess = videosToRecode.slice(0, maxVideosToProcess);

    console.log(`🎬 开始重编码 ${videosToProcess.length} 个视频（最大并发: ${maxConcurrent}）`);

    const results = [];
    const errors = [];

    // 使用Promise.allSettled并发处理，但限制并发数量
    for (let i = 0; i < videosToProcess.length; i += maxConcurrent) {
      const batch = videosToProcess.slice(i, i + maxConcurrent);
      console.log(`处理批次 ${Math.floor(i/maxConcurrent) + 1}: ${batch.length} 个视频`);

      const batchPromises = batch.map(async (video) => {
        try {
          console.log(`🔄 重编码: ${video.originalKey}`);
          const recodedUrl = await processVideoRecoding(video.originalKey, video.mobileKey);
          return {
            success: true,
            originalKey: video.originalKey,
            mobileKey: video.mobileKey,
            recodedUrl
          };
        } catch (error) {
          console.error(`❌ 重编码失败: ${video.originalKey}`, error);
          return {
            success: false,
            originalKey: video.originalKey,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value);
          } else {
            errors.push(result.value);
          }
        } else {
          errors.push({
            success: false,
            error: result.reason?.message || "未知错误"
          });
        }
      });
    }

    const successCount = results.length;
    const errorCount = errors.length;
    const remainingCount = videosToRecode.length - videosToProcess.length;

    console.log(`✅ 批量重编码完成:`);
    console.log(`- 成功: ${successCount} 个`);
    console.log(`- 失败: ${errorCount} 个`);
    console.log(`- 剩余: ${remainingCount} 个`);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: `批量重编码完成`,
        summary: {
          processed: videosToProcess.length,
          successful: successCount,
          failed: errorCount,
          remaining: remainingCount,
          total: videosToRecode.length
        },
        results,
        errors: errorCount > 0 ? errors : undefined,
        nextBatch: remainingCount > 0 ? {
          message: `还有 ${remainingCount} 个视频待处理，请再次调用API继续处理`,
          remainingVideos: videosToRecode.slice(videosToProcess.length).map(v => v.originalKey)
        } : undefined
      }),
    };

  } catch (error) {
    console.error("批量重编码失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to batch reencode videos",
        details: error.message,
      }),
    };
  }
}

// 扫描现有视频并自动转换需要重编码的文件
async function scanAndConvertVideos(event, user, corsHeaders) {
  try {
    console.log("🔍 开始扫描现有视频并进行转换...");

    const body = event.body ? JSON.parse(event.body) : {};
    const folderPath = body.folderPath || ""; // 空字符串表示扫描所有文件夹
    const dryRun = body.dryRun !== false; // 默认为试运行模式
    const maxFiles = Math.min(body.maxFiles || 20, 50); // 限制最大处理文件数，避免超时

    console.log("扫描参数:", { folderPath, dryRun, maxFiles });

    // 获取用户有权限访问的文件夹
    const userFolders = await getUserAccessibleFolders(user);
    console.log("用户可访问文件夹:", userFolders);

    // 列出S3中的所有MP4视频文件
    const listParams = {
      Bucket: VIDEO_BUCKET,
      Prefix: folderPath ? `videos/${folderPath}/` : "videos/",
      MaxKeys: 1000, // 限制扫描范围
    };

    console.log("S3查询参数:", listParams);
    const listCommand = new ListObjectsV2Command(listParams);
    const response = await s3Client.send(listCommand);

    if (!response.Contents) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "没有找到任何视频文件",
          summary: {
            totalScanned: 0,
            needsConversion: 0,
            hasConversion: 0,
            dryRun
          }
        }),
      };
    }

    // 过滤出需要检查的视频文件
    const videoFiles = response.Contents
      .filter(obj => {
        const key = obj.Key;
        // 只处理.mp4文件，排除_mobile.mp4文件
        if (!key.endsWith('.mp4') || key.includes('_mobile.mp4')) {
          return false;
        }

        // 检查用户权限
        const relativePath = key.replace('videos/', '');
        const pathParts = relativePath.split('/');

        // 如果文件直接在 videos/ 根目录下（没有子文件夹）
        if (pathParts.length === 1) {
          return true; // 开放给所有有 videos 权限的用户
        }

        // 如果文件在子文件夹中，检查文件夹权限
        const videoFolder = pathParts[0];
        return userFolders.includes(videoFolder);
      })
      .slice(0, maxFiles); // 限制处理文件数量

    console.log(`找到 ${videoFiles.length} 个待检查的视频文件`);

    const needsConversion = [];
    const hasConversion = [];
    const errors = [];

    // 检查每个视频是否已有移动版本
    for (const file of videoFiles) {
      try {
        const originalKey = file.Key;
        const mobileKey = originalKey.replace('.mp4', '_mobile.mp4');

        // 检查是否已存在移动版本
        try {
          await s3Client.send(new HeadObjectCommand({
            Bucket: VIDEO_BUCKET,
            Key: mobileKey,
          }));

          hasConversion.push({
            originalKey,
            mobileKey,
            size: file.Size
          });
        } catch (error) {
          if (error.name === 'NotFound') {
            needsConversion.push({
              originalKey,
              mobileKey,
              size: file.Size
            });
          } else {
            console.error(`检查移动版本失败 ${originalKey}:`, error);
            errors.push({
              originalKey,
              error: error.message
            });
          }
        }
      } catch (error) {
        console.error(`处理文件失败 ${file.Key}:`, error);
        errors.push({
          originalKey: file.Key,
          error: error.message
        });
      }
    }

    const summary = {
      totalScanned: videoFiles.length,
      needsConversion: needsConversion.length,
      hasConversion: hasConversion.length,
      errors: errors.length,
      dryRun
    };

    console.log("扫描结果:", summary);

    // 如果是试运行模式，直接返回结果
    if (dryRun) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `扫描完成：发现 ${needsConversion.length} 个视频需要转换`,
          summary,
          needsConversion: needsConversion.slice(0, 10), // 只返回前10个作为预览
          hasConversion: hasConversion.slice(0, 5), // 只返回前5个作为预览
          errors: errors.slice(0, 5) // 只返回前5个错误
        }),
      };
    }

    // 实际转换模式：处理需要转换的视频
    const conversionResults = [];
    const conversionErrors = [];
    const maxConcurrentConversions = 3; // 控制并发数量避免超时

    console.log(`开始转换 ${needsConversion.length} 个视频，并发数: ${maxConcurrentConversions}`);

    // 分批处理转换任务
    for (let i = 0; i < needsConversion.length; i += maxConcurrentConversions) {
      const batch = needsConversion.slice(i, i + maxConcurrentConversions);

      const batchPromises = batch.map(async (video) => {
        try {
          console.log(`🎬 开始转换: ${video.originalKey}`);
          const result = await convertVideoWithMediaConvert(video.originalKey);
          conversionResults.push({
            originalKey: video.originalKey,
            mobileKey: video.mobileKey,
            jobId: result.jobId,
            status: 'submitted'
          });
          console.log(`✅ 转换任务提交成功: ${video.originalKey}`);
        } catch (error) {
          console.error(`❌ 转换失败 ${video.originalKey}:`, error);
          conversionErrors.push({
            originalKey: video.originalKey,
            error: error.message
          });
        }
      });

      // 等待当前批次完成
      await Promise.all(batchPromises);
    }

    const finalSummary = {
      ...summary,
      conversionsSubmitted: conversionResults.length,
      conversionErrors: conversionErrors.length,
      dryRun: false
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `扫描并转换完成：提交了 ${conversionResults.length} 个转换任务`,
        summary: finalSummary,
        conversionResults,
        conversionErrors: conversionErrors.slice(0, 5),
        note: "MediaConvert任务已提交，转换过程将在后台进行，预计2-4分钟完成"
      }),
    };

  } catch (error) {
    console.error("扫描和转换失败:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Failed to scan and convert videos",
        details: error.message,
      }),
    };
  }
}

# Trigger deployment
