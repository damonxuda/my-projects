#!/bin/bash

# 快速创建TRADING_LAMBDA函数（首次设置）
# 后续通过GitHub Actions自动部署

set -e

echo "🚀 创建TRADING_LAMBDA函数..."

# 配置
FUNCTION_NAME="TRADING_LAMBDA"
RUNTIME="nodejs20.x"
REGION="ap-northeast-1"

# 获取现有Lambda函数的执行角色（复用）
echo "📋 获取Lambda执行角色..."
ROLE_ARN=$(aws lambda get-function \
  --function-name FILE_MANAGEMENT_LAMBDA \
  --region ${REGION} \
  --query 'Configuration.Role' \
  --output text)

echo "✅ 使用角色: ${ROLE_ARN}"

# 创建临时部署包
echo "📦 创建部署包..."
zip -q function.zip index.mjs

# 创建Lambda函数
echo "🔧 创建Lambda函数..."
aws lambda create-function \
  --function-name ${FUNCTION_NAME} \
  --runtime ${RUNTIME} \
  --role ${ROLE_ARN} \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 256 \
  --description "LLM Trading Decision Maker - Gemini API" \
  --region ${REGION}

echo "✅ Lambda函数创建成功！"

# 清理
rm function.zip

echo ""
echo "📝 下一步："
echo "1. 配置GitHub Secrets (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
echo "2. 推送代码触发自动部署"
echo "3. 或手动运行: gh workflow run deploy-lambda.yml"
echo ""
echo "✅ 完成！"
