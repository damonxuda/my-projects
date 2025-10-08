# 🚀 部署指南

## ⚠️ 重要提醒

### AWS Lambda 部署

**本项目使用 GitHub Actions 自动部署 - 请勿手动打包上传！**

### Lambda函数分类

项目中有不同类型的Lambda函数，使用不同的部署策略：

#### 1. Video Management微服务（6个函数，使用Lambda Layer）
- FILE_MANAGEMENT_LAMBDA
- VIDEO_PLAYER_LAMBDA
- YOUTUBE_MANAGER_LAMBDA
- FORMAT_CONVERTER_LAMBDA
- THUMBNAIL_GENERATOR_LAMBDA
- SUBTITLE_MANAGER_LAMBDA

**特点**：
- 使用Lambda Layer: `arn:aws:lambda:ap-northeast-1:730335478220:layer:video-management-nodejs-deps:1`
- 只部署代码（index.mjs + shared/ + lib/），不含node_modules
- 路径：`backend/lambda-video-management/services/*/`

#### 2. 独立Lambda函数（无依赖）
- user_management

**特点**：
- 单文件Lambda，无外部依赖
- 只打包.mjs文件
- 路径：`backend/lambda-user-management/`

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

---

## 🔧 添加新Lambda函数到自动部署

当你创建新的Lambda函数时，根据类型选择相应的配置方式：

### 类型A：需要依赖的Lambda（类似video-management）

如果新Lambda需要npm packages：

1. **创建或更新Lambda Layer**（如果依赖不同）
2. **在workflow中添加到matrix**：
   ```yaml
   # 在 .github/workflows/deploy-lambda.yml
   strategy:
     matrix:
       service:
         - name: YOUR_NEW_LAMBDA
           path: services/your-service
   ```
3. **配置Lambda使用Layer**（AWS控制台或CLI）

### 类型B：无依赖的单文件Lambda（类似user-management）

如果新Lambda只有单个文件，无外部依赖：

1. **添加新job到workflow**：
   ```yaml
   # 在 .github/workflows/deploy-lambda.yml
   deploy-your-lambda:
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
       - name: Package
         run: zip -r function.zip *.mjs
       - name: Deploy
         run: aws lambda update-function-code ...
   ```

2. **更新paths过滤**：
   ```yaml
   on:
     push:
       paths:
         - 'backend/your-lambda-path/**'
   ```

### 类型C：有依赖但希望打包到部署包

如果新Lambda有依赖但不想用Layer：

1. **添加npm install步骤**
2. **打包时包含node_modules**
3. **注意：部署包会很大，上传慢**

**推荐使用类型A或B，避免类型C。**
