# Lambda环境变量管理最佳实践

## 🔍 当前Lambda环境变量分析

### 📊 现有环境变量配置

所有3个Lambda函数都配置了相同的环境变量：
```bash
ADMIN_EMAILS=damon.xu@gmail.com
CLERK_SECRET_KEY=sk_live_YOUR_CLERK_SECRET_KEY_HERE
VIDEO_BUCKET_NAME=damonxuda-video-files
```

### 🔧 代码中使用的环境变量

```javascript
// 当前Lambda代码中使用的环境变量：
process.env.AWS_REGION                    // AWS区域配置
process.env.VIDEO_BUCKET_NAME             // S3存储桶名称
process.env.CLERK_SECRET_KEY               // Clerk认证密钥
process.env.ADMIN_EMAILS                   // 管理员邮箱列表
process.env.MEDIACONVERT_ROLE_ARN          // MediaConvert服务角色
process.env.MEDIACONVERT_QUEUE_ARN         // MediaConvert处理队列
```

## 🏆 Lambda环境变量管理最佳实践

### 1. **开发环境管理**

#### ✅ 推荐方案：项目级环境配置文件

```bash
# 创建Lambda专用的环境配置文件
lambda-video-management/
├── config/
│   ├── env.development.json
│   ├── env.staging.json
│   └── env.production.json
├── deploy/
│   └── deploy-with-env.sh
└── services/
    ├── video-core/
    ├── video-processing/
    └── youtube/
```

**示例配置文件结构：**

```json
// config/env.development.json
{
  "CLERK_SECRET_KEY": "sk_test_...",
  "VIDEO_BUCKET_NAME": "damonxuda-video-files-dev",
  "ADMIN_EMAILS": "your-dev-email@gmail.com",
  "MEDIACONVERT_ROLE_ARN": "arn:aws:iam::730335478220:role/service-role/MediaConvert_Default_Role",
  "MEDIACONVERT_QUEUE_ARN": "arn:aws:mediaconvert:ap-northeast-1:730335478220:queues/Default"
}

// config/env.production.json
{
  "CLERK_SECRET_KEY": "sk_live_...",
  "VIDEO_BUCKET_NAME": "damonxuda-video-files",
  "ADMIN_EMAILS": "damon.xu@gmail.com",
  "MEDIACONVERT_ROLE_ARN": "arn:aws:iam::730335478220:role/service-role/MediaConvert_Default_Role",
  "MEDIACONVERT_QUEUE_ARN": "arn:aws:mediaconvert:ap-northeast-1:730335478220:queues/Default"
}
```

### 2. **部署时环境变量注入**

#### ✅ 推荐方案：部署脚本自动配置

```bash
#!/bin/bash
# deploy/deploy-with-env.sh

ENVIRONMENT=${1:-development}
CONFIG_FILE="config/env.${ENVIRONMENT}.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

echo "🔧 使用环境配置: $ENVIRONMENT"

# 为每个Lambda函数设置环境变量
for FUNCTION in video-core-lambda video-processing-lambda youtube-lambda; do
    echo "📦 更新 $FUNCTION 环境变量..."

    aws lambda update-function-configuration \
        --function-name $FUNCTION \
        --environment "Variables=$(cat $CONFIG_FILE | jq -c .)" \
        --region ap-northeast-1

    echo "✅ $FUNCTION 环境变量已更新"
done
```

### 3. **环境变量安全管理**

#### 🔐 敏感信息管理策略

**方案A：AWS Systems Manager Parameter Store**
```bash
# 存储敏感配置
aws ssm put-parameter \
    --name "/lambda/video-management/clerk-secret-key" \
    --value "sk_live_..." \
    --type "SecureString"

# Lambda代码中读取
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
```

**方案B：AWS Secrets Manager**
```bash
# 创建密钥
aws secretsmanager create-secret \
    --name "lambda-video-management" \
    --description "Video management Lambda secrets" \
    --secret-string file://secrets.json
```

**方案C：使用部署脚本（当前推荐）**
```bash
# 使用现有的部署脚本，自动从环境变量读取配置
cd lambda-video-management/services
./deploy-5-functions.sh

# 脚本会自动部署所有5个微服务：
# - file-management
# - format-converter
# - thumbnail-generator
# - video-player
# - youtube-manager
```

### 4. **本地开发环境**

#### 🛠️ 推荐方案：本地环境文件

```bash
# lambda-video-management/.env.local (不进入git)
CLERK_SECRET_KEY=sk_test_your_test_key_here
VIDEO_BUCKET_NAME=damonxuda-video-files-dev
ADMIN_EMAILS=your-dev-email@gmail.com
AWS_REGION=ap-northeast-1
```

```javascript
// 本地测试时加载环境变量
if (process.env.NODE_ENV === 'development') {
    require('dotenv').config({ path: '.env.local' });
}
```

## 🎯 针对您项目的具体建议

### 即时改进方案（最小改动）

1. **创建配置文件目录**
   ```bash
   mkdir lambda-video-management/config
   ```

2. **将当前环境变量导出为配置文件**
   ```bash
   # 自动生成当前生产环境配置
   aws lambda get-function-configuration \
     --function-name video-core-lambda \
     --query 'Environment.Variables' > config/env.production.json
   ```

3. **在GitHub Secrets中管理敏感变量**
   - `LAMBDA_CLERK_SECRET_KEY`
   - `LAMBDA_VIDEO_BUCKET_NAME`
   - `LAMBDA_ADMIN_EMAILS`
   - `LAMBDA_MEDIACONVERT_ROLE_ARN`

### 长期优化方案

1. **集成到现有GitHub Actions**
   - 扩展现有的deploy.yml
   - 添加Lambda环境变量更新步骤
   - 支持不同环境的配置管理

2. **使用AWS Parameter Store**
   - 敏感配置集中管理
   - 支持配置版本控制
   - 细粒度权限控制

## ⚠️ 安全注意事项

1. **永远不要在代码中硬编码敏感信息**
2. **使用不同的密钥用于开发和生产环境**
3. **定期轮换密钥和访问凭证**
4. **限制环境变量的访问权限**
5. **配置文件需要添加到.gitignore**

## 📝 推荐的.gitignore规则

```gitignore
# Lambda环境配置
lambda-video-management/.env.local
lambda-video-management/.env.development
lambda-video-management/config/env.*.json
!lambda-video-management/config/env.template.json
```

---
**最佳实践总结**: 使用GitHub Secrets管理敏感配置 + 配置文件管理非敏感配置 + 部署时自动注入环境变量