import { MediaConvertClient, CreateJobCommand } from "@aws-sdk/client-mediaconvert";
import { S3Client, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-northeast-1" });
const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME || "damonxuda-video-files";

/**
 * 使用MediaConvert生成缩略图 - 专门处理MOOV在mdat后面的文件
 */
export async function generateThumbnailWithMediaConvert(videoKey) {
  try {
    console.log("🎬 使用MediaConvert生成缩略图 (MOOV在后文件专用)");
    console.log("视频文件:", videoKey);

    // 检查视频文件是否存在
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    }));
    const fileSize = headResult.ContentLength;
    console.log(`📊 文件大小: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);

    // 生成缩略图key
    const thumbnailKey = videoKey
      .replace(/^videos\//, 'thumbnails/')
      .replace(/\.[^/.]+$/, '.jpg');

    // 检查缩略图是否已存在
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: thumbnailKey,
      }));

      console.log("缩略图已存在，返回现有的");
      const thumbnailUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: VIDEO_BUCKET, Key: thumbnailKey }),
        { expiresIn: 3600 }
      );

      return createSuccessResponse({
        success: true,
        thumbnailUrl,
        thumbnailKey,
        cached: true,
        method: "mediaconvert"
      });
    } catch (headError) {
      if (headError.name !== "NotFound") {
        throw headError;
      }
    }

    // 创建MediaConvert客户端
    const mediaConvertClient = new MediaConvertClient({
      region: process.env.AWS_REGION || "ap-northeast-1",
      endpoint: "https://mediaconvert.ap-northeast-1.amazonaws.com"
    });

    // 构建MediaConvert作业参数
    const jobParams = {
      Role: "arn:aws:iam::730335478220:role/MediaConvertRole",
      Settings: {
        Inputs: [{
          FileInput: `s3://${VIDEO_BUCKET}/${videoKey}`,
          VideoSelector: {},
          AudioSelectors: {}
        }],
        OutputGroups: [{
          Name: "Thumbnail Output Group",
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: `s3://${VIDEO_BUCKET}/thumbnails/${videoKey.replace(/^videos\//, '').replace(/\.[^/.]+$/, '')}`
            }
          },
          Outputs: [{
            NameModifier: "_thumb",
            VideoDescription: {
              CodecSettings: {
                Codec: "FRAME_CAPTURE",
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 1,
                  MaxCaptures: 1,  // 只生成一张缩略图
                  Quality: 80
                }
              },
              Width: 320,
              Height: 240,
              ScalingBehavior: "DEFAULT"
            },
            ContainerSettings: {
              Container: "RAW"
            },
            Extension: "jpg"
          }]
        }]
      },
      Queue: "arn:aws:mediaconvert:ap-northeast-1:730335478220:queues/Default",
      ClientRequestToken: `thumbnail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    console.log("🚀 提交MediaConvert缩略图作业...");

    const command = new CreateJobCommand(jobParams);
    const result = await mediaConvertClient.send(command);

    console.log("✅ MediaConvert作业已提交:", result.Job.Id);
    console.log("作业状态:", result.Job.Status);

    // 由于MediaConvert是异步的，我们返回作业信息
    // 实际缩略图将在几分钟内生成
    return createSuccessResponse({
      success: true,
      method: "mediaconvert",
      jobId: result.Job.Id,
      status: result.Job.Status,
      message: "MediaConvert缩略图作业已提交，将在几分钟内完成",
      thumbnailKey: thumbnailKey,
      estimatedCompletion: "2-5分钟"
    });

  } catch (error) {
    console.error("MediaConvert缩略图生成失败:", error);
    return createErrorResponse(500, "Failed to generate MediaConvert thumbnail", error.message);
  }
}

/**
 * 批量处理MOOV在后的问题文件
 */
export async function batchProcessMoovAfterFiles() {
  const problemFiles = [
    'videos/Movies/ri.mp4',
    'videos/Movies/BBAN-024.mp4',
    'videos/Movies/BBAN-301.mp4',
    'videos/Movies/8108.mp4',
    'videos/Movies/roselip-fetish-0834_hd.mp4'
  ];

  const results = [];

  for (const videoKey of problemFiles) {
    try {
      console.log(`\n🔄 处理: ${videoKey}`);
      const result = await generateThumbnailWithMediaConvert(videoKey);
      results.push({ videoKey, success: true, result });
    } catch (error) {
      console.error(`❌ ${videoKey} 处理失败:`, error);
      results.push({ videoKey, success: false, error: error.message });
    }
  }

  return results;
}