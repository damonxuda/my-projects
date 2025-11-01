#!/bin/bash

# ⚠️ 【已弃用 - DEPRECATED】
# 此脚本仅供历史参考，不再使用。
# 所有部署现在通过 GitHub Actions 自动化：.github/workflows/deploy-lambda.yml
# 请使用 `git push` 进行部署，以保持配置变更的历史记录。
#
# AWS Lambda Trading 函数一键设置脚本
# 用途：创建Lambda Layer、Lambda函数和CloudWatch Events定时触发器

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  LLM Trading Lambda 设置脚本${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 配置变量
AWS_REGION="ap-northeast-1"
FUNCTION_NAME="TRADING_LAMBDA"
LAYER_NAME="trading-dependencies"
S3_BUCKET="damonxuda-video-files"
RUNTIME="nodejs20.x"

# 从环境变量或GitHub Secrets读取
if [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${YELLOW}请设置环境变量 GEMINI_API_KEY${NC}"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${YELLOW}请设置环境变量 SUPABASE_URL${NC}"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${YELLOW}请设置环境变量 SUPABASE_SERVICE_ROLE_KEY${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 环境变量检查通过${NC}"
echo ""

# ============================================
# 1. 创建 Lambda Layer
# ============================================
echo -e "${BLUE}步骤 1: 创建 Lambda Layer (依赖包)${NC}"

# 创建临时目录
rm -rf layer
mkdir -p layer/nodejs
cd layer/nodejs

# 安装依赖
npm init -y > /dev/null 2>&1
npm install @supabase/supabase-js@^2.39.0 > /dev/null 2>&1

cd ..

# 打包
zip -r trading-dependencies-layer.zip nodejs/ > /dev/null

echo -e "${GREEN}✅ Layer打包完成${NC}"

# 发布 Layer
echo "📤 发布Lambda Layer..."
LAYER_ARN=$(aws lambda publish-layer-version \
  --layer-name ${LAYER_NAME} \
  --description "Dependencies for LLM Trading Lambda (@supabase/supabase-js)" \
  --zip-file fileb://trading-dependencies-layer.zip \
  --compatible-runtimes ${RUNTIME} \
  --region ${AWS_REGION} \
  --query 'LayerVersionArn' \
  --output text)

echo -e "${GREEN}✅ Layer创建成功: ${LAYER_ARN}${NC}"
cd ..

# ============================================
# 2. 创建 Lambda 函数
# ============================================
echo ""
echo -e "${BLUE}步骤 2: 创建 Lambda 函数${NC}"

# 打包函数代码
zip -r function.zip index.mjs > /dev/null

# 检查函数是否已存在
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${AWS_REGION} > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  函数已存在，将更新代码${NC}"

  # 更新代码
  aws lambda update-function-code \
    --function-name ${FUNCTION_NAME} \
    --zip-file fileb://function.zip \
    --region ${AWS_REGION} > /dev/null

  # 更新配置
  aws lambda update-function-configuration \
    --function-name ${FUNCTION_NAME} \
    --environment "Variables={GEMINI_API_KEY=${GEMINI_API_KEY},SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}}" \
    --layers ${LAYER_ARN} \
    --region ${AWS_REGION} > /dev/null

  echo -e "${GREEN}✅ 函数更新成功${NC}"
else
  echo "📦 创建新的Lambda函数..."

  # 获取Lambda执行角色（假设已存在）
  ROLE_ARN=$(aws iam get-role --role-name lambda-execution-role --query 'Role.Arn' --output text 2>/dev/null || echo "")

  if [ -z "$ROLE_ARN" ]; then
    echo -e "${YELLOW}⚠️  未找到lambda-execution-role，请手动指定IAM角色ARN${NC}"
    echo "请输入Lambda执行角色ARN:"
    read ROLE_ARN
  fi

  # 创建函数
  aws lambda create-function \
    --function-name ${FUNCTION_NAME} \
    --runtime ${RUNTIME} \
    --role ${ROLE_ARN} \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --timeout 60 \
    --memory-size 256 \
    --environment "Variables={GEMINI_API_KEY=${GEMINI_API_KEY},SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}}" \
    --layers ${LAYER_ARN} \
    --region ${AWS_REGION} > /dev/null

  echo -e "${GREEN}✅ 函数创建成功${NC}"
fi

# ============================================
# 3. 配置 CloudWatch Events (EventBridge)
# ============================================
echo ""
echo -e "${BLUE}步骤 3: 配置定时触发器 (每小时执行一次)${NC}"

RULE_NAME="trading-lambda-hourly"

# 创建规则（每小时执行一次）
aws events put-rule \
  --name ${RULE_NAME} \
  --schedule-expression "rate(1 hour)" \
  --description "Trigger LLM Trading Lambda every hour" \
  --region ${AWS_REGION} > /dev/null

echo -e "${GREEN}✅ CloudWatch Events规则创建成功${NC}"

# 获取Lambda函数ARN
FUNCTION_ARN=$(aws lambda get-function \
  --function-name ${FUNCTION_NAME} \
  --region ${AWS_REGION} \
  --query 'Configuration.FunctionArn' \
  --output text)

# 添加目标（Lambda函数）
aws events put-targets \
  --rule ${RULE_NAME} \
  --targets "Id=1,Arn=${FUNCTION_ARN}" \
  --region ${AWS_REGION} > /dev/null

echo -e "${GREEN}✅ 触发器目标配置成功${NC}"

# 授予CloudWatch Events调用Lambda的权限
aws lambda add-permission \
  --function-name ${FUNCTION_NAME} \
  --statement-id ${RULE_NAME}-permission \
  --action 'lambda:InvokeFunction' \
  --principal events.amazonaws.com \
  --source-arn $(aws events describe-rule --name ${RULE_NAME} --region ${AWS_REGION} --query 'Arn' --output text) \
  --region ${AWS_REGION} > /dev/null 2>&1 || echo "权限可能已存在，跳过"

echo -e "${GREEN}✅ 权限配置成功${NC}"

# ============================================
# 完成
# ============================================
echo ""
echo -e "${BLUE}======================================${NC}"
echo -e "${GREEN}🎉 设置完成！${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "📊 Lambda函数: ${FUNCTION_NAME}"
echo "⏰ 执行频率: 每小时一次"
echo "🔗 Layer ARN: ${LAYER_ARN}"
echo ""
echo "🧪 测试命令:"
echo "  aws lambda invoke --function-name ${FUNCTION_NAME} --region ${AWS_REGION} response.json"
echo ""
echo "📈 查看日志:"
echo "  aws logs tail /aws/lambda/${FUNCTION_NAME} --follow --region ${AWS_REGION}"
echo ""
