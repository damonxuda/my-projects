#!/bin/bash

echo "🚀 部署所有Lambda视频管理服务..."
echo "=================================="

# 检查是否在项目根目录
if [ ! -d "services" ]; then
    echo "❌ 错误: 请在项目根目录下运行此脚本"
    exit 1
fi

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 部署函数
deploy_service() {
    local service_name=$1
    local service_dir=$2

    echo ""
    echo -e "${YELLOW}📦 部署 ${service_name}...${NC}"
    echo "=================================="

    cd "$service_dir" || {
        echo -e "${RED}❌ 无法进入目录: $service_dir${NC}"
        return 1
    }

    if [ ! -f "deploy.sh" ]; then
        echo -e "${RED}❌ 部署脚本不存在: $service_dir/deploy.sh${NC}"
        cd - > /dev/null
        return 1
    fi

    if ./deploy.sh; then
        echo -e "${GREEN}✅ ${service_name} 部署成功${NC}"
        cd - > /dev/null
        return 0
    else
        echo -e "${RED}❌ ${service_name} 部署失败${NC}"
        cd - > /dev/null
        return 1
    fi
}

# 检查必要的环境变量
echo "🔍 检查环境变量..."
required_vars=("CLERK_SECRET_KEY" "ADMIN_EMAILS" "VIDEO_BUCKET_NAME")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ 缺少必要的环境变量:${NC}"
    printf '   %s\n' "${missing_vars[@]}"
    echo ""
    echo "请设置这些环境变量后重新运行脚本"
    exit 1
fi

echo -e "${GREEN}✅ 环境变量检查通过${NC}"

# 部署计数器
deployed=0
failed=0

# 按顺序部署服务
services=(
    "video-core-lambda:services/video-core"
    "video-processing-lambda:services/video-processing"
    "youtube-lambda:services/youtube"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r service_name service_dir <<< "$service_info"

    if deploy_service "$service_name" "$service_dir"; then
        ((deployed++))
    else
        ((failed++))
    fi
done

# 总结
echo ""
echo "=================================="
echo -e "${YELLOW}📊 部署总结${NC}"
echo "=================================="
echo -e "✅ 成功: ${GREEN}$deployed${NC} 个服务"
echo -e "❌ 失败: ${RED}$failed${NC} 个服务"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}🎉 所有服务部署成功！${NC}"
    echo ""
    echo "📋 API端点总览:"
    echo "Video Core Service:"
    echo "  - GET  /videos/list"
    echo "  - GET  /videos/url/{key}"
    echo "  - DELETE /videos/delete"
    echo "  - POST /videos/thumbnail/{key}"
    echo ""
    echo "Video Processing Service:"
    echo "  - POST /process/video"
    echo "  - POST /process/batch"
    echo "  - GET  /job/status?jobId={jobId}"
    echo ""
    echo "YouTube Service:"
    echo "  - POST /download"
    echo "  - GET  /info?url={youtube_url}"
    echo "  - GET  /history"
    echo ""
    echo -e "${YELLOW}💡 提示: 记得更新前端配置中的API端点URL${NC}"
else
    echo -e "${RED}⚠️  有 $failed 个服务部署失败，请检查错误信息${NC}"
    exit 1
fi