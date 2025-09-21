import { S3Client } from "@aws-sdk/client-s3";

// S3客户端配置
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

// 环境变量
export const VIDEO_BUCKET = process.env.VIDEO_BUCKET_NAME || "damonxuda-video-files";

// CORS响应头 - 注释掉，使用Function URL的CORS配置避免重复
// export const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type, Authorization",
// };
export const corsHeaders = {}; // 空对象，使用Function URL CORS

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