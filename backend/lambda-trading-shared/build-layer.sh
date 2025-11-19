#!/bin/bash

# Lambda Layer 构建脚本
# 用途：打包共享模块为 AWS Lambda Layer

echo "🔨 Building Lambda Trading Shared Layer..."

# 清理旧构建
rm -rf layer lambda-trading-shared-layer.zip

# 创建 layer 目录结构
mkdir -p layer/nodejs

# 复制所有模块文件和依赖
echo "📦 Copying modules and dependencies..."
cp *.mjs layer/nodejs/
cp package.json layer/nodejs/
cp -r node_modules layer/nodejs/

# 打包
echo "🗜️  Creating zip archive..."
cd layer
zip -r ../lambda-trading-shared-layer.zip nodejs/ -q

cd ..

# 显示文件大小
FILE_SIZE=$(du -h lambda-trading-shared-layer.zip | cut -f1)
echo "✅ Layer built successfully: lambda-trading-shared-layer.zip ($FILE_SIZE)"

echo ""
echo "📤 To publish to AWS Lambda:"
echo "  aws lambda publish-layer-version \\"
echo "    --layer-name lambda-trading-shared \\"
echo "    --zip-file fileb://lambda-trading-shared-layer.zip \\"
echo "    --compatible-runtimes nodejs20.x \\"
echo "    --region ap-northeast-1"

echo ""
echo "🧹 To clean up:"
echo "  rm -rf layer lambda-trading-shared-layer.zip"
