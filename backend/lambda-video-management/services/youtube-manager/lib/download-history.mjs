import { ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

export async function listDownloadHistory(event, user) {
  try {
    console.log("=== 获取YouTube下载历史 ===");

    const queryParams = event.queryStringParameters || {};
    const {
      limit = "50",
      startAfter = "",
      filterByUser = "false"
    } = queryParams;

    console.log("查询参数:", { limit, startAfter, filterByUser });

    // 构建S3查询参数
    const listParams = {
      Bucket: VIDEO_BUCKET,
      Prefix: "videos/",
      MaxKeys: Math.min(parseInt(limit), 1000),
      StartAfter: startAfter
    };

    const response = await s3Client.send(new ListObjectsV2Command(listParams));

    if (!response.Contents) {
      return createSuccessResponse({
        downloads: [],
        totalCount: 0,
        hasMore: false
      });
    }

    console.log("找到文件数量:", response.Contents.length);

    // 过滤出YouTube下载的文件并获取详细信息
    const youtubeFiles = [];

    for (const obj of response.Contents) {
      try {
        // 跳过文件夹
        if (obj.Key.endsWith("/")) continue;

        // 获取文件的元数据
        const headResponse = await s3Client.send(new HeadObjectCommand({
          Bucket: VIDEO_BUCKET,
          Key: obj.Key
        }));

        // 检查是否是YouTube下载的文件
        if (headResponse.Metadata && headResponse.Metadata.source === "youtube") {
          const downloadInfo = {
            key: obj.Key,
            fileName: obj.Key.split('/').pop(),
            size: obj.Size,
            lastModified: obj.LastModified,
            downloadedAt: headResponse.Metadata["download-date"],
            downloadedBy: headResponse.Metadata["downloaded-by"],
            youtubeInfo: {
              originalUrl: headResponse.Metadata["original-url"],
              videoId: headResponse.Metadata["video-id"],
              title: headResponse.Metadata.title,
              duration: headResponse.Metadata.duration ? parseInt(headResponse.Metadata.duration) : null,
              uploader: headResponse.Metadata.uploader,
              quality: headResponse.Metadata.quality
            }
          };

          // 如果设置了按用户过滤
          if (filterByUser === "true" && downloadInfo.downloadedBy !== user.id) {
            continue;
          }

          youtubeFiles.push(downloadInfo);
        }
      } catch (headError) {
        console.warn("获取文件元数据失败:", obj.Key, headError.message);
        // 继续处理其他文件
      }
    }

    // 按下载时间排序（最新的在前）
    youtubeFiles.sort((a, b) => {
      const dateA = new Date(a.downloadedAt || a.lastModified);
      const dateB = new Date(b.downloadedAt || b.lastModified);
      return dateB - dateA;
    });

    console.log("YouTube下载文件数量:", youtubeFiles.length);

    // 统计信息
    const stats = {
      totalDownloads: youtubeFiles.length,
      totalSize: youtubeFiles.reduce((sum, file) => sum + file.size, 0),
      downloaderStats: {}
    };

    // 按下载者统计
    youtubeFiles.forEach(file => {
      const downloader = file.downloadedBy || "unknown";
      if (!stats.downloaderStats[downloader]) {
        stats.downloaderStats[downloader] = {
          count: 0,
          totalSize: 0
        };
      }
      stats.downloaderStats[downloader].count++;
      stats.downloaderStats[downloader].totalSize += file.size;
    });

    // 质量分布统计
    const qualityStats = {};
    youtubeFiles.forEach(file => {
      const quality = file.youtubeInfo.quality || "unknown";
      qualityStats[quality] = (qualityStats[quality] || 0) + 1;
    });

    return createSuccessResponse({
      downloads: youtubeFiles,
      totalCount: youtubeFiles.length,
      hasMore: response.IsTruncated || false,
      nextStartAfter: response.NextContinuationToken,
      statistics: {
        ...stats,
        qualityDistribution: qualityStats,
        averageFileSize: stats.totalDownloads > 0 ? Math.round(stats.totalSize / stats.totalDownloads) : 0
      },
      filters: {
        limit: parseInt(limit),
        filterByUser: filterByUser === "true",
        currentUser: user.id
      }
    });

  } catch (error) {
    console.error("获取下载历史失败:", error);
    return createErrorResponse(500, "Failed to get download history", error.message);
  }
}

export async function getDownloadStats(event, user) {
  try {
    console.log("=== 获取下载统计信息 ===");

    const queryParams = event.queryStringParameters || {};
    const { timeRange = "all" } = queryParams;

    // 这里可以根据时间范围过滤，为简化暂时返回所有统计
    const historyResponse = await listDownloadHistory({
      queryStringParameters: { limit: "1000", filterByUser: "false" }
    }, user);

    if (historyResponse.statusCode !== 200) {
      return historyResponse;
    }

    const data = JSON.parse(historyResponse.body);
    const downloads = data.downloads;

    // 时间序列统计
    const timeStats = {};
    const now = new Date();
    const timeRanges = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000
    };

    downloads.forEach(download => {
      const downloadDate = new Date(download.downloadedAt || download.lastModified);
      const dayKey = downloadDate.toISOString().split('T')[0];

      if (!timeStats[dayKey]) {
        timeStats[dayKey] = { count: 0, totalSize: 0 };
      }
      timeStats[dayKey].count++;
      timeStats[dayKey].totalSize += download.size;
    });

    // 最受欢迎的上传者
    const uploaderStats = {};
    downloads.forEach(download => {
      const uploader = download.youtubeInfo.uploader || "Unknown";
      if (!uploaderStats[uploader]) {
        uploaderStats[uploader] = { count: 0, totalSize: 0, totalDuration: 0 };
      }
      uploaderStats[uploader].count++;
      uploaderStats[uploader].totalSize += download.size;
      uploaderStats[uploader].totalDuration += download.youtubeInfo.duration || 0;
    });

    const topUploaders = Object.entries(uploaderStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([uploader, stats]) => ({ uploader, ...stats }));

    return createSuccessResponse({
      overview: {
        totalDownloads: downloads.length,
        totalSize: downloads.reduce((sum, d) => sum + d.size, 0),
        totalDuration: downloads.reduce((sum, d) => sum + (d.youtubeInfo.duration || 0), 0),
        averageFileSize: downloads.length > 0 ? Math.round(downloads.reduce((sum, d) => sum + d.size, 0) / downloads.length) : 0
      },
      timeSeriesData: Object.entries(timeStats)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, stats]) => ({ date, ...stats })),
      topUploaders,
      qualityDistribution: data.statistics.qualityDistribution,
      downloaderActivity: data.statistics.downloaderStats
    });

  } catch (error) {
    console.error("获取下载统计失败:", error);
    return createErrorResponse(500, "Failed to get download statistics", error.message);
  }
}