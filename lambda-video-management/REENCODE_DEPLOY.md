# 视频重编码功能部署说明

## 功能概述

新增的视频重编码功能可以将不兼容移动端的视频文件重新编码为移动端兼容的格式，解决移动端Safari浏览器播放某些MP4文件时出现错误代码4的问题。

## 技术实现

### 后端（Lambda函数）

1. **新增API端点**:
   - `POST /videos/reencode/{videoKey}` - 单个视频重编码
   - `POST /videos/reencode/batch` - 批量视频重编码
2. **编码参数**:
   - 视频编码：H.264 baseline profile level 3.0
   - 音频编码：AAC 44.1kHz 128kbps
   - 容器：MP4 with faststart flag
   - 最大比特率：1Mbps

3. **处理流程**:
   - 下载原视频到Lambda临时存储
   - 使用ffmpeg重编码为移动端兼容格式
   - 上传重编码后的视频到S3（文件名添加_mobile后缀）
   - 返回重编码视频的预签名URL

### 前端（React组件）

1. **自动检测**: 识别移动端设备和错误代码4
2. **UI增强**: 在播放失败时显示"重编码为移动端格式"按钮
3. **进度显示**: 显示重编码进度和状态

## 部署步骤

### 1. 更新Lambda函数

```bash
# 打包更新后的Lambda函数
cd lambda-video-management
zip -r lambda-function-with-reencode.zip index.mjs node_modules/ package.json

# 使用AWS CLI或控制台更新Lambda函数代码
aws lambda update-function-code \
  --function-name your-video-lambda-function \
  --zip-file fileb://lambda-function-with-reencode.zip
```

### 2. 确认ffmpeg Layer

确保Lambda函数已附加ffmpeg layer，路径应该是 `/opt/bin/ffmpeg`

### 3. 调整Lambda配置

重编码功能需要更多资源：
- **内存**: 建议至少1GB（1024MB）
- **超时时间**: 建议至少10分钟（600秒）
- **临时存储**: 确保有足够空间（至少1GB）

### 4. 更新前端代码

```bash
# 部署更新后的React应用
cd videos
npm run build
# 上传build文件夹到你的Web服务器
```

## 测试步骤

### 1. 本地测试

```bash
# 设置环境变量（可选，如不设置将使用默认URL）
export REACT_APP_VIDEO_API_URL="https://你的Lambda函数URL"

# 更新test-reencode.js中的token和videoKey
node test-reencode.js
```

### 2. 浏览器测试

1. 在移动端设备上打开视频播放系统
2. 尝试播放之前出现错误代码4的视频
3. 确认出现"重编码为移动端格式"按钮
4. 点击按钮测试重编码功能

### 3. 批量重编码测试

```bash
# 设置环境变量（可选）
export REACT_APP_VIDEO_API_URL="https://你的Lambda函数URL"

# 测试批量重编码功能（试运行模式）
node test-batch-reencode.js
```

**批量重编码API参数**:
- `dryRun`: true=试运行模式，false=实际执行
- `folderPath`: 指定文件夹名称或空字符串表示所有文件夹
- `maxConcurrent`: 最大并发重编码数量（建议2-3）
- `forceReencode`: 是否强制重编码已有移动版本的视频

## 文件命名规则

- 原视频：`videos/folder/filename.mp4`
- 重编码视频：`videos/folder/filename_mobile.mp4`

## 注意事项

1. **成本**: 重编码会消耗Lambda计算时间，大文件可能产生较高费用
2. **存储**: 重编码后的视频会占用额外S3存储空间
3. **缓存**: 系统会检查是否已有重编码版本，避免重复处理
4. **权限**: 重编码功能继承原有的文件夹权限控制
5. **批量处理**:
   - 建议先使用试运行模式（dryRun: true）了解需要处理的视频数量
   - 批量重编码会自动限制并发数量避免Lambda超时
   - 大量视频需要分批处理，API会返回剩余视频信息

## 故障排除

### Lambda超时
- 增加超时时间到10分钟
- 对于特别大的文件，可能需要分段处理

### 内存不足
- 增加Lambda内存配置
- 检查临时存储使用情况

### ffmpeg错误
- 检查ffmpeg layer是否正确安装
- 验证输入视频文件是否完整

## 监控建议

1. 监控Lambda执行时间和内存使用
2. 跟踪重编码成功率
3. 监控S3存储使用量增长
4. 设置CloudWatch告警

重编码功能将显著改善移动端用户的视频播放体验，解决格式兼容性问题。