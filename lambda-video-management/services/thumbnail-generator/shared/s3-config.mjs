import { S3Client } from "@aws-sdk/client-s3";

// S3客户端配置
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

// 环境变量
export const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME || "damonxuda-video-files";

// CORS响应头 - 移动端兼容性增强
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Amz-Security-Token',
  'Access-Control-Expose-Headers': 'Content-Length, Date, ETag',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'
};

// 标准响应格式化
export function createResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
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