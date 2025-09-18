import { clerkClient } from "@clerk/clerk-sdk-node";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
// MediaConvert导入暂时禁用
// import {
//   MediaConvertClient,
//   CreateJobCommand,
//   DescribeEndpointsCommand,
// } from "@aws-sdk/client-mediaconvert";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";


const s3Client = new S3Client({ region: "ap-northeast-1" });
const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// MediaConvert variables - 暂时禁用
// let mediaConvertClient = null;
// const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN || 'arn:aws:iam::730335478220:role/MediaConver-S3-Role';
// const MEDIACONVERT_QUEUE = process.env.MEDIACONVERT_QUEUE || 'Default';
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

// MediaConvert客户端初始化（暂时禁用）
async function initializeMediaConvertClient() {
  console.log("MediaConvert暂时禁用");
  return null;
}

// 使用MediaConvert生成缩略图（策略3: 终极方案）
async function generateThumbnailWithMediaConvert(videoPath, thumbnailKey) {
  console.log("🎬 MediaConvert暂时不可用，使用默认缩略图");
  console.log("📹 大文件:", videoPath);
  
  // 暂时返回默认缩略图，避免复杂性导致的不稳定
  return `https://${VIDEO_BUCKET}.s3.ap-northeast-1.amazonaws.com/default-thumbnail.jpg`;
}

