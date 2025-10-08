import { S3Client } from "@aws-sdk/client-s3";

// S3客户端配置
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-1",
});

// 环境变量 - 必需配置
export const VIDEO_BUCKET = process.env.AWS_S3_VIDEO_BUCKET_NAME;

if (!VIDEO_BUCKET) {
  throw new Error("AWS_S3_VIDEO_BUCKET_NAME 环境变量未配置");
}

// CORS响应头 - 使用Function URL的CORS配置，避免重复头
export const corsHeaders = {};

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