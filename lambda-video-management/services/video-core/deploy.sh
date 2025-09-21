#!/bin/bash

echo "🚀 部署 video-core-lambda..."

# 检查是否在正确的目录
if [ ! -f "index.mjs" ]; then
    echo "❌ 错误: 请在 video-core 目录下运行此脚本"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 创建部署包
echo "📁 创建部署包..."
zip -r video-core-lambda.zip index.mjs lib/ node_modules/ package.json ../shared/

# 检查AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI 未安装"
    exit 1
fi

# 检查Lambda函数是否存在
FUNCTION_NAME="video-core-lambda"
if aws lambda get-function --function-name $FUNCTION_NAME &> /dev/null; then
    echo "🔄 更新现有Lambda函数..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://video-core-lambda.zip
else
    echo "🆕 创建新Lambda函数..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs20.x \
        --role arn:aws:iam::730335478220:role/service-role/video_management-role-4tceqnka \
        --handler index.handler \
        --zip-file fileb://video-core-lambda.zip \
        --memory-size 512 \
        --timeout 30 \
        --environment Variables="{CLERK_SECRET_KEY=$CLERK_SECRET_KEY,ADMIN_EMAILS=$ADMIN_EMAILS,VIDEO_BUCKET_NAME=$VIDEO_BUCKET_NAME}" \
        --layers arn:aws:lambda:ap-northeast-1:730335478220:layer:ffmpeg:2
fi

# 创建或更新函数URL
echo "🔗 配置Lambda函数URL..."
aws lambda create-function-url-config \
    --function-name $FUNCTION_NAME \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["GET","POST","DELETE","OPTIONS"],"AllowHeaders":["content-type","authorization"]}' \
    --auth-type NONE \
    2>/dev/null || \
aws lambda update-function-url-config \
    --function-name $FUNCTION_NAME \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["GET","POST","DELETE","OPTIONS"],"AllowHeaders":["content-type","authorization"]}' \
    --auth-type NONE

# 获取函数URL
FUNCTION_URL=$(aws lambda get-function-url-config --function-name $FUNCTION_NAME --query 'FunctionUrl' --output text)

echo "✅ video-core-lambda 部署完成!"
echo "📍 函数URL: $FUNCTION_URL"
echo ""
echo "📋 API端点:"
echo "  GET  $FUNCTION_URL/videos/list"
echo "  GET  $FUNCTION_URL/videos/url/{key}"
echo "  DELETE $FUNCTION_URL/videos/delete"
echo "  POST $FUNCTION_URL/videos/thumbnail/{key}"

# 清理
rm video-core-lambda.zip

echo "🧹 部署包已清理"