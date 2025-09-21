# GitHub Secrets 配置指南 - Lambda微服务重构

## 需要添加的新Secrets

您需要在GitHub仓库的Settings > Secrets and variables > Actions中添加以下新的Repository secrets：

### 🔧 新增的微服务Lambda URLs

```bash
# 1. 视频核心服务 (video-core-lambda)
REACT_APP_VIDEO_CORE_API_URL=https://nxgwaryei337g4hvrm7ajoteza0kgjaj.lambda-url.ap-northeast-1.on.aws

# 2. 视频处理服务 (video-processing-lambda)
REACT_APP_VIDEO_PROCESSING_API_URL=https://tgshtgiaemzbmcmzuqzto4gh2a0mbrex.lambda-url.ap-northeast-1.on.aws

# 3. YouTube服务 (youtube-lambda)
REACT_APP_YOUTUBE_API_URL=https://at7ugqs533akhbol5bqahhfxtu0mjuff.lambda-url.ap-northeast-1.on.aws
```

### 📋 配置步骤

1. **访问GitHub仓库设置**
   - 进入您的GitHub仓库: `https://github.com/damonxuda/my-projects`
   - 点击 `Settings` 标签
   - 在左侧菜单中选择 `Secrets and variables` > `Actions`

2. **添加新的Repository secrets**
   点击 `New repository secret` 按钮，依次添加：

   **Secret 1:**
   - Name: `REACT_APP_VIDEO_CORE_API_URL`
   - Value: `https://nxgwaryei337g4hvrm7ajoteza0kgjaj.lambda-url.ap-northeast-1.on.aws`

   **Secret 2:**
   - Name: `REACT_APP_VIDEO_PROCESSING_API_URL`
   - Value: `https://tgshtgiaemzbmcmzuqzto4gh2a0mbrex.lambda-url.ap-northeast-1.on.aws`

   **Secret 3:**
   - Name: `REACT_APP_YOUTUBE_API_URL`
   - Value: `https://at7ugqs533akhbol5bqahhfxtu0mjuff.lambda-url.ap-northeast-1.on.aws`

### ✅ 验证配置

配置完成后，您现有的Secrets应该包含：

**现有Secrets (保持不变):**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `REACT_APP_CLERK_PUBLISHABLE_KEY`
- `REACT_APP_USER_MANAGEMENT_API_URL`
- `REACT_APP_ADMIN_EMAILS`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

**新增Secrets:**
- ✅ `REACT_APP_VIDEO_CORE_API_URL`
- ✅ `REACT_APP_VIDEO_PROCESSING_API_URL`
- ✅ `REACT_APP_YOUTUBE_API_URL`

### 🔄 部署影响

配置完成后：
1. **下次GitHub Actions部署时**，将自动使用新的微服务URLs
2. **现有的 `REACT_APP_VIDEO_API_URL`** 将自动设为 video-core 服务URL (向后兼容)
3. **前端代码无需修改**，环境变量会自动注入

### ⚠️ 重要提醒

- **旧的单体Lambda** `REACT_APP_VIDEO_API_URL` Secret可以保留但不会被使用
- **本地开发**时，.env文件中的硬编码URL仍然有效
- **生产环境**部署会完全使用GitHub Secrets中的配置

### 🚀 测试部署

配置完成后，推送任何代码变更到main分支，GitHub Actions会：
1. 自动检测到videos/admin项目变化
2. 使用新的微服务URLs构建前端
3. 部署到S3，用户访问时使用新架构

---
**文档创建时间**: 2025-09-21
**相关重构**: Lambda视频管理服务微服务化
**后续更新**: 如果Lambda URLs发生变化，只需更新GitHub Secrets，无需修改代码