# 🚀 部署指南

## ⚠️ 重要提醒

### AWS Lambda 部署

**本项目使用 GitHub Actions 自动部署 - 请勿手动打包上传！**

#### 正确的部署流程：

```bash
# 1. 修改代码
vim backend/lambda-video-management/services/subtitle-manager/index.mjs

# 2. 提交并推送（触发自动部署）
git add .
git commit -m "Fix: 修复字幕URL问题"
git push origin main

# 3. 等待GitHub Actions完成部署
# 查看进度：https://github.com/damonxuda/my-projects/actions
```

#### Lambda Layer 配置

- **所有Lambda函数已配置Layer**：`arn:aws:lambda:ap-northeast-1:730335478220:layer:video-management-nodejs-deps:1`
- **部署时只打包代码文件**（index.mjs + shared/），**不打包node_modules**
- **Layer包含所有依赖**，无需在部署包中包含

#### 6个Lambda函数

1. FILE_MANAGEMENT_LAMBDA
2. VIDEO_PLAYER_LAMBDA
3. YOUTUBE_MANAGER_LAMBDA
4. FORMAT_CONVERTER_LAMBDA
5. THUMBNAIL_GENERATOR_LAMBDA
6. SUBTITLE_MANAGER_LAMBDA

详细说明见：`backend/lambda-video-management/README.md`

---

### 前端部署

前端使用GitHub Actions自动部署到GitHub Pages：

```bash
git add .
git commit -m "Update frontend"
git push origin main
# 自动触发 .github/workflows/deploy.yml
```

---

## 环境变量配置

### GitHub Secrets（用于CI/CD）

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `CLERK_PUBLISHABLE_KEY`
- `REACT_APP_FILE_MANAGEMENT_API_URL`
- `REACT_APP_VIDEO_PLAYER_API_URL`
- `REACT_APP_SUBTITLE_API_URL`
- 等...

### Lambda 环境变量

- `AWS_S3_VIDEO_BUCKET_NAME`: damonxuda-video-files
- `CLERK_SECRET_KEY`: sk_live_xxx
- `ADMIN_EMAILS`: damon.xu@gmail.com

---

## 开发工作流

```bash
# 1. 开发
# 2. 本地测试
# 3. git commit + push（自动部署）
# 4. 验证部署结果
```

**记住：永远使用 git push 触发自动部署，不要手动打包上传！**
