#!/bin/bash

# 5个Lambda函数部署脚本
# 使用新的微服务架构

set -e

echo "🚀 开始部署5个专门化Lambda函数..."

# 函数配置
FUNCTIONS=(
    "file-management:FILE_MANAGEMENT_LAMBDA"
    "thumbnail-generator:THUMBNAIL_GENERATOR_LAMBDA"
    "format-converter:FORMAT_CONVERTER_LAMBDA"
    "video-player:VIDEO_PLAYER_LAMBDA"
    "youtube-manager:YOUTUBE_MANAGER_LAMBDA"
)

# AWS配置
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
RUNTIME="nodejs18.x"
TIMEOUT=60
MEMORY_SIZE=512

# 环境变量（所有函数共用）
ENVIRONMENT_VARIABLES="Variables={
    CLERK_SECRET_KEY=${CLERK_SECRET_KEY},
    VIDEO_BUCKET_NAME=${VIDEO_BUCKET_NAME:-damonxuda-video-files}
}"

# 创建部署包的函数
create_deployment_package() {
    local func_dir=$1
    local func_name=$2

    echo "📦 为 $func_name 创建部署包..."

    cd "$func_dir"

    # 安装依赖
    if [ -f "package.json" ]; then
        npm install --production
    fi

    # 创建zip包
    zip -r "../${func_name}-deployment.zip" . -x "*.git*" "node_modules/.cache/*"

    cd ..

    echo "✅ $func_name 部署包创建完成"
}

# 部署Lambda函数
deploy_function() {
    local func_dir=$1
    local func_name=$2

    echo "🚀 部署 $func_name..."

    # 检查函数是否存在
    if aws lambda get-function --function-name "$func_name" --region "$AWS_REGION" >/dev/null 2>&1; then
        echo "📝 更新现有函数: $func_name"

        # 更新函数代码
        aws lambda update-function-code \
            --function-name "$func_name" \
            --zip-file "fileb://${func_name}-deployment.zip" \
            --region "$AWS_REGION"

        # 更新函数配置
        aws lambda update-function-configuration \
            --function-name "$func_name" \
            --runtime "$RUNTIME" \
            --timeout "$TIMEOUT" \
            --memory-size "$MEMORY_SIZE" \
            --environment "$ENVIRONMENT_VARIABLES" \
            --region "$AWS_REGION"
    else
        echo "🆕 创建新函数: $func_name"

        # 创建新函数
        aws lambda create-function \
            --function-name "$func_name" \
            --runtime "$RUNTIME" \
            --role "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/service-role/video_management-role-4tceqnka" \
            --handler "index.handler" \
            --zip-file "fileb://${func_name}-deployment.zip" \
            --timeout "$TIMEOUT" \
            --memory-size "$MEMORY_SIZE" \
            --environment "$ENVIRONMENT_VARIABLES" \
            --region "$AWS_REGION"

        # 等待函数创建完成
        aws lambda wait function-active --function-name "$func_name" --region "$AWS_REGION"

        # 创建Function URL
        aws lambda create-function-url-config \
            --function-name "$func_name" \
            --auth-type NONE \
            --cors '{"AllowCredentials":true,"AllowMethods":["*"],"AllowOrigins":["*"],"AllowHeaders":["*"],"MaxAge":3600}' \
            --region "$AWS_REGION"
    fi

    # 清理部署包
    rm -f "${func_name}-deployment.zip"

    echo "✅ $func_name 部署完成"
}

# 主部署流程
main() {
    # 检查必要环境变量
    if [ -z "$CLERK_SECRET_KEY" ]; then
        echo "❌ 错误: CLERK_SECRET_KEY环境变量未设置"
        exit 1
    fi

    # 检查AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "❌ 错误: AWS CLI未安装"
        exit 1
    fi

    # 检查AWS凭证
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "❌ 错误: AWS凭证未配置"
        exit 1
    fi

    echo "🔍 当前AWS账户: $(aws sts get-caller-identity --query Account --output text)"
    echo "🌍 部署区域: $AWS_REGION"

    # 遍历所有函数
    for func_config in "${FUNCTIONS[@]}"; do
        IFS=':' read -r func_dir func_name <<< "$func_config"

        if [ ! -d "$func_dir" ]; then
            echo "⚠️  警告: 目录 $func_dir 不存在，跳过"
            continue
        fi

        echo ""
        echo "===== 处理 $func_name ====="

        create_deployment_package "$func_dir" "$func_name"
        deploy_function "$func_dir" "$func_name"
    done

    echo ""
    echo "🎉 所有函数部署完成！"
    echo ""
    echo "📋 Function URLs:"

    # 显示所有Function URL
    for func_config in "${FUNCTIONS[@]}"; do
        IFS=':' read -r func_dir func_name <<< "$func_config"

        if aws lambda get-function --function-name "$func_name" --region "$AWS_REGION" >/dev/null 2>&1; then
            url=$(aws lambda get-function-url-config --function-name "$func_name" --region "$AWS_REGION" --query 'FunctionUrl' --output text 2>/dev/null || echo "未配置")
            echo "  $func_name: $url"
        fi
    done

    echo ""
    echo "💡 请更新前端环境变量:"
    echo "  REACT_APP_FILE_MANAGEMENT_API_URL=<FILE_MANAGEMENT_LAMBDA的URL>"
    echo "  REACT_APP_THUMBNAIL_GENERATOR_API_URL=<THUMBNAIL_GENERATOR_LAMBDA的URL>"
    echo "  REACT_APP_FORMAT_CONVERTER_API_URL=<FORMAT_CONVERTER_LAMBDA的URL>"
    echo "  REACT_APP_VIDEO_PLAYER_API_URL=<VIDEO_PLAYER_LAMBDA的URL>"
    echo "  REACT_APP_YOUTUBE_MANAGER_API_URL=<YOUTUBE_MANAGER_LAMBDA的URL>"
}

# 运行主流程
main "$@"