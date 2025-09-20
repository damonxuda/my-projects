#!/usr/bin/env node

// 测试视频重编码API的脚本
const videoKey = "videos/贾老师初联一轮/第1讲 有理数 例13.mp4"; // 你可以改成其他视频
// 使用环境变量，如果没有则使用默认值
const apiUrl = process.env.REACT_APP_VIDEO_API_URL || "https://phbhgxbk36dwtku4hq5na7csxa0slnay.lambda-url.ap-northeast-1.on.aws";

// 从你的视频播放系统获取token
// 你需要先在浏览器控制台运行: window.getCachedToken()
const token = "YOUR_TOKEN_HERE"; // 替换为真实token

async function testReencode() {
  try {
    console.log("🎬 开始测试视频重编码...");
    console.log("视频文件:", videoKey);

    const response = await fetch(`${apiUrl}/videos/reencode/${encodeURIComponent(videoKey)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("响应状态:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ 重编码失败:", errorText);
      return;
    }

    const result = await response.json();
    console.log("✅ 重编码成功:", result);

    if (result.recodedUrl) {
      console.log("📱 移动端兼容视频URL:", result.recodedUrl);
      console.log("🆔 重编码文件key:", result.recodedKey);
      console.log("💾 是否使用缓存:", result.cached);
    }

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

if (token === "YOUR_TOKEN_HERE") {
  console.log("❌ 请先设置有效的token");
  console.log("1. 在浏览器中打开你的视频系统");
  console.log("2. 在控制台运行: window.getCachedToken()");
  console.log("3. 复制token并替换脚本中的 YOUR_TOKEN_HERE");
} else {
  testReencode();
}