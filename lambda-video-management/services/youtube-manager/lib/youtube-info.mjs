import { createSuccessResponse, createErrorResponse } from "../../shared/s3-config.mjs";
import ytdlp from "yt-dlp-exec";

export async function getVideoInfo(event, user) {
  try {
    console.log("=== 获取YouTube视频信息 ===");

    const queryParams = event.queryStringParameters || {};
    const { url } = queryParams;

    if (!url) {
      return createErrorResponse(400, "Missing required parameter: url");
    }

    // 验证YouTube URL
    if (!isValidYouTubeUrl(url)) {
      return createErrorResponse(400, "Invalid YouTube URL");
    }

    console.log("获取视频信息:", url);

    try {
      // 获取视频信息，不下载视频
      const videoInfo = await ytdlp(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        skipDownload: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:googlebot'
        ]
      });

      console.log("视频信息获取成功");

      // 格式化响应数据
      const formattedInfo = {
        basic: {
          id: videoInfo.id,
          title: videoInfo.title,
          description: videoInfo.description?.slice(0, 500) + (videoInfo.description?.length > 500 ? '...' : ''),
          duration: videoInfo.duration,
          durationString: formatDuration(videoInfo.duration),
          uploadDate: videoInfo.upload_date,
          uploader: videoInfo.uploader,
          uploaderUrl: videoInfo.uploader_url,
          viewCount: videoInfo.view_count,
          likeCount: videoInfo.like_count,
          url: videoInfo.webpage_url
        },
        technical: {
          formats: videoInfo.formats?.map(format => ({
            formatId: format.format_id,
            ext: format.ext,
            quality: format.quality,
            resolution: format.resolution,
            fps: format.fps,
            vcodec: format.vcodec,
            acodec: format.acodec,
            filesize: format.filesize,
            filesizeApprox: format.filesize_approx
          })).filter(f => f.ext && (f.vcodec !== 'none' || f.acodec !== 'none')) || [],
          thumbnails: videoInfo.thumbnails?.map(thumb => ({
            id: thumb.id,
            url: thumb.url,
            width: thumb.width,
            height: thumb.height
          })) || [],
          categories: videoInfo.categories || [],
          tags: videoInfo.tags?.slice(0, 20) || [] // 限制标签数量
        },
        availability: {
          isLive: videoInfo.is_live || false,
          wasLive: videoInfo.was_live || false,
          liveStatus: videoInfo.live_status,
          availability: videoInfo.availability
        }
      };

      // 添加推荐下载格式
      const recommendedFormats = getRecommendedFormats(videoInfo.formats || []);

      return createSuccessResponse({
        success: true,
        videoInfo: formattedInfo,
        recommendedFormats,
        downloadOptions: {
          qualities: ["480p", "720p", "1080p", "best"],
          defaultQuality: "720p"
        }
      });

    } catch (ytdlError) {
      console.error("获取视频信息失败:", ytdlError);

      // 根据错误类型返回更友好的错误信息
      let errorMessage = ytdlError.message;
      if (ytdlError.message.includes("Video unavailable")) {
        errorMessage = "视频不可用，可能已被删除或设为私有";
      } else if (ytdlError.message.includes("Private video")) {
        errorMessage = "这是私有视频，无法获取信息";
      } else if (ytdlError.message.includes("Sign in to confirm")) {
        errorMessage = "该视频需要登录才能观看";
      } else if (ytdlError.message.includes("429")) {
        errorMessage = "请求过于频繁，请稍后再试";
      }

      return createErrorResponse(400, "Failed to get video information", errorMessage);
    }

  } catch (error) {
    console.error("获取视频信息失败:", error);
    return createErrorResponse(500, "Failed to get video information", error.message);
  }
}

function isValidYouTubeUrl(url) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)[a-zA-Z0-9_-]{11}/;
  return youtubeRegex.test(url);
}

function formatDuration(seconds) {
  if (!seconds) return "未知";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

function getRecommendedFormats(formats) {
  // 过滤出有视频和音频的格式
  const videoFormats = formats.filter(f =>
    f.vcodec && f.vcodec !== 'none' &&
    f.acodec && f.acodec !== 'none' &&
    f.ext === 'mp4'
  );

  // 按质量分组
  const qualityGroups = {
    "480p": videoFormats.filter(f => f.height && f.height <= 480),
    "720p": videoFormats.filter(f => f.height && f.height <= 720 && f.height > 480),
    "1080p": videoFormats.filter(f => f.height && f.height <= 1080 && f.height > 720)
  };

  const recommended = [];

  Object.entries(qualityGroups).forEach(([quality, formats]) => {
    if (formats.length > 0) {
      // 选择最好的格式（通常是文件大小最大的）
      const best = formats.reduce((prev, current) =>
        (current.filesize || current.filesize_approx || 0) > (prev.filesize || prev.filesize_approx || 0)
          ? current : prev
      );

      recommended.push({
        quality,
        formatId: best.format_id,
        resolution: best.resolution,
        filesize: best.filesize || best.filesize_approx,
        fps: best.fps,
        vcodec: best.vcodec,
        acodec: best.acodec
      });
    }
  });

  return recommended;
}