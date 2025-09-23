import { S3Client } from "@aws-sdk/client-s3";

// S3客户端配置
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

// 环境变量
export const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME || "damonxuda-video-files";

// CORS响应头 - Function URL已配置CORS，这里只保留必要的头
export const corsHeaders = {
  "Content-Type": "application/json",
};

// 标准响应格式化
export function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      ...additionalHeaders,
    },
    body: JSON.stringify(body),
  };
}

// 错误响应
export function createErrorResponse(statusCode, error, details = null) {
  const body = { error };
  if (details) {
    body.details = details;
  }
  return createResponse(statusCode, body);
}

// 成功响应
export function createSuccessResponse(data, additionalHeaders = {}) {
  return createResponse(200, data, additionalHeaders);
}