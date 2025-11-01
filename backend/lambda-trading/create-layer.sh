#!/bin/bash

# 创建 Lambda Layer 用于 trading lambda 的依赖
# 只需要运行一次，创建后会得到 Layer ARN

echo "📦 Creating Lambda Layer for trading dependencies..."

# 创建临时目录
mkdir -p layer/nodejs
cd layer/nodejs

# 安装依赖到 layer 目录
npm init -y
npm install @supabase/supabase-js@^2.39.0

cd ../..

# 打包 layer
cd layer
zip -r trading-dependencies-layer.zip nodejs/
cd ..

echo "✅ Layer package created: layer/trading-dependencies-layer.zip"
echo ""
echo "📤 Next steps:"
echo "1. Upload to AWS Lambda Layer:"
echo "   aws lambda publish-layer-version \\"
echo "     --layer-name trading-dependencies \\"
echo "     --description 'Dependencies for LLM Trading Lambda (@supabase/supabase-js)' \\"
echo "     --zip-file fileb://layer/trading-dependencies-layer.zip \\"
echo "     --compatible-runtimes nodejs18.x nodejs20.x \\"
echo "     --region ap-northeast-1"
echo ""
echo "2. Save the returned LayerVersionArn for use in Lambda function"
