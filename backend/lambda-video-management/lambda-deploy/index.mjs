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
const VIDEO_BUCKET = process.env.AWS_S3_VIDEO_BUCKET_NAME;
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
      return await listVideos(corsHeaders);
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
      return await getVideoUrl(videoKey, corsHeaders);
    } else if (method === "POST" && path === "/upload-youtube") {
      return await uploadYouTubeJson(event, user, corsHeaders);
    } else if (method === "DELETE" && path === "/videos/delete") {
      return await deleteVideo(event, user, corsHeaders);
    } else if (method === "POST" && path.startsWith("/videos/thumbnail/")) {
      const rawPath = event.rawPath || event.requestContext.http.path;
      const rawVideoKey = rawPath.replace("/videos/thumbnail/", "");
      const videoKey = decodeURIComponent(rawVideoKey);
      return await generateThumbnail(videoKey, corsHeaders);
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

async function listVideos(corsHeaders) {
  try {
    console.log("--- 开始获取视频列表 ---");
    console.log("VIDEO_BUCKET:", VIDEO_BUCKET);

    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
    });

    const response = await s3Client.send(command);
    console.log("S3响应:", response.Contents?.length || 0, "个对象");

    // 支持视频文件和YouTube JSON文件
    const allFiles =
      response.Contents?.filter((item) => {
        const filename = item.Key.split("/").pop();
        const isVideo = isVideoFile(filename);
        const isYouTube = isYouTubeJsonFile(filename);
        const hasSize = item.Size > 0;

        console.log(
          `文件检查: ${filename} | 是否视频: ${isVideo} | 是否YouTube: ${isYouTube} | 有大小: ${hasSize}`
        );

        return (isVideo || isYouTube) && hasSize;
      }) || [];

    console.log("过滤后的文件:", allFiles.length, "个");
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
    throw new Error(`Failed to list videos: ${error.message}`);
  }
}

async function getVideoUrl(videoKey, corsHeaders) {
  try {
    console.log("--- 生成视频URL ---");
    console.log("videoKey:", videoKey);

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
    throw new Error(`Failed to generate video URL: ${error.message}`);
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

    // 构建缩略图文件名 - videoKey已经包含了videos/前缀
    const videoPath = videoKey;
    const thumbnailKey = `thumbnails/${videoKey.replace('videos/', '').replace(/\.[^.]+$/, '')}.jpg`;
    
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
        const downloadSize = Math.min(fileSize, 100 * 1024 * 1024); // 最多100MB
        
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

