#!/bin/bash
set -e

echo "📦 创建Lambda Layer (trading-dependencies)..."

# 清理旧的layer目录
rm -rf layer
mkdir -p layer/nodejs

# 安装依赖
cd layer/nodejs
npm init -y > /dev/null 2>&1
npm install @supabase/supabase-js@^2.39.0

cd ..

# 打包
zip -q -r trading-dependencies-layer.zip nodejs/

# 发布Layer
echo "📤 发布Lambda Layer..."
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name trading-dependencies \
  --description "Supabase client for Trading Lambda" \
  --zip-file fileb://trading-dependencies-layer.zip \
  --compatible-runtimes nodejs20.x \
  --region ap-northeast-1 \
  --query 'LayerVersionArn' \
  --output text)

echo "✅ Layer创建成功: ${LAYER_ARN}"

# 附加到Lambda函数
echo "🔗 附加Layer到TRADING_LAMBDA..."
aws lambda update-function-configuration \
  --function-name TRADING_LAMBDA \
  --layers ${LAYER_ARN} \
  --region ap-northeast-1 > /dev/null

echo "⏳ 等待配置更新..."
aws lambda wait function-updated --function-name TRADING_LAMBDA --region ap-northeast-1

echo "✅ Layer已附加到Lambda函数！"

# 清理
cd ..
rm -rf layer

echo ""
echo "🎉 完成！现在可以测试Lambda了："
echo "aws lambda invoke --function-name TRADING_LAMBDA --region ap-northeast-1 response.json"
