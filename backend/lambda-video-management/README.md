# Lambda Video Management 微服务架构

## ⚠️ 重要：自动化部署流程

**本项目使用 GitHub Actions 自动部署 - 请勿手动打包上传！**

### 部署方式

1. **✅ 推荐：使用 GitHub Actions 自动部署**
   ```bash
   git add .
   git commit -m "Update Lambda function"
   git push origin main
   ```
   - GitHub Actions会自动检测变更
   - 自动打包并部署到所有6个Lambda函数
   - 部署配置：`.github/workflows/deploy-lambda.yml`

2. **❌ 不推荐：手动部署**
   - 仅在紧急情况或GitHub Actions不可用时使用

### Lambda Layer 配置

**所有Lambda函数已配置Lambda Layer用于依赖管理：**

- **Layer ARN**: `arn:aws:lambda:ap-northeast-1:730335478220:layer:video-management-nodejs-deps:1`
- **包含依赖**: 所有package.json中的依赖已打包在Layer中
- **部署原则**: 只部署代码文件（index.mjs + shared/），不包含node_modules

### 微服务架构

项目包含6个Lambda函数，每个函数都使用相同的Lambda Layer：

1. **FILE_MANAGEMENT_LAMBDA** (`services/file-management/`)
   - 文件列表、上传、删除等文件操作

2. **VIDEO_PLAYER_LAMBDA** (`services/video-player/`)
   - 视频播放URL生成

3. **YOUTUBE_MANAGER_LAMBDA** (`services/youtube-manager/`)
   - YouTube相关功能

4. **FORMAT_CONVERTER_LAMBDA** (`services/format-converter/`)
   - 视频格式转换、重编码

5. **THUMBNAIL_GENERATOR_LAMBDA** (`services/thumbnail-generator/`)
   - 缩略图生成

6. **SUBTITLE_MANAGER_LAMBDA** (`services/subtitle-manager/`)
   - 字幕生成（AWS Transcribe）、翻译（AWS Translate）

### 环境变量

所有Lambda函数共享以下环境变量：
- `AWS_S3_VIDEO_BUCKET_NAME`: S3存储桶名称
- `CLERK_SECRET_KEY`: Clerk认证密钥
- `ADMIN_EMAILS`: 管理员邮箱列表

### 开发和测试

```bash
# 安装依赖
npm install

# 本地测试
npm test

# 部署 (通过GitHub Actions)
git push origin main
```

### 紧急手动部署步骤

仅在GitHub Actions不可用时：

```bash
# 进入服务目录
cd services/subtitle-manager

# 只打包代码（不包含node_modules）
zip -r function.zip index.mjs shared/ -x "*.DS_Store"

# 上传到S3并更新Lambda
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
aws s3 cp function.zip s3://damonxuda-video-files/lambda-deploy/SUBTITLE_MANAGER_LAMBDA-${TIMESTAMP}.zip

aws lambda update-function-code \
  --function-name SUBTITLE_MANAGER_LAMBDA \
  --s3-bucket damonxuda-video-files \
  --s3-key lambda-deploy/SUBTITLE_MANAGER_LAMBDA-${TIMESTAMP}.zip
```

## 故障排查

### Lambda Layer 相关
- 确保Lambda函数配置中已添加Layer ARN
- Layer包含所有运行时依赖，代码包中不应包含node_modules

### GitHub Actions 调试
- 查看Actions运行日志：https://github.com/用户名/仓库名/actions
- 确保AWS credentials配置在GitHub Secrets中
