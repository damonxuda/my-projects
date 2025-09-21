import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

export async function getVideoUrl(videoKey) {
  try {
    console.log("--- 生成视频URL ---");
    console.log("videoKey:", videoKey);

    // 生成预签名URL
    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    console.log("生成预签名URL成功");

    return createSuccessResponse({
      url: signedUrl,
      key: videoKey,
      expiresIn: 3600
    });

  } catch (error) {
    console.error("生成视频URL失败:", error);
    return createErrorResponse(500, "Failed to generate video URL", error.message);
  }
}