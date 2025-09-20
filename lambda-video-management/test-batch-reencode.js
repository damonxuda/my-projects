#!/usr/bin/env node

// 测试批量视频重编码API的脚本
// 使用环境变量，如果没有则使用默认值
const apiUrl = process.env.REACT_APP_VIDEO_API_URL || "https://phbhgxbk36dwtku4hq5na7csxa0slnay.lambda-url.ap-northeast-1.on.aws";

// 从你的视频播放系统获取token
// 你需要先在浏览器控制台运行: window.getCachedToken()
const token = "YOUR_TOKEN_HERE"; // 替换为真实token

async function testBatchReencodeDryRun() {
  try {
    console.log("🔍 测试批量重编码（试运行模式）...");

    const response = await fetch(`${apiUrl}/videos/reencode/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dryRun: true, // 试运行模式，只检测不实际重编码
        folderPath: "", // 空字符串表示检查所有文件夹
        maxConcurrent: 3
      })
    });

    console.log("响应状态:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ 试运行失败:", errorText);
      return;
    }

    const result = await response.json();
    console.log("✅ 试运行成功:");
    console.log("📊 统计信息:", result.summary);

    if (result.videosToRecode && result.videosToRecode.length > 0) {
      console.log("🎬 需要重编码的视频:");
      result.videosToRecode.slice(0, 5).forEach((video, index) => {
        console.log(`  ${index + 1}. ${video.path} (${(video.size / 1024 / 1024).toFixed(1)}MB)`);
      });
      if (result.videosToRecode.length > 5) {
        console.log(`  ... 还有 ${result.videosToRecode.length - 5} 个视频`);
      }
    }

    if (result.alreadyRecoded && result.alreadyRecoded.length > 0) {
      console.log("✅ 已有移动版本的视频:");
      result.alreadyRecoded.slice(0, 3).forEach((video, index) => {
        console.log(`  ${index + 1}. ${video}`);
      });
      if (result.alreadyRecoded.length > 3) {
        console.log(`  ... 还有 ${result.alreadyRecoded.length - 3} 个视频`);
      }
    }

  } catch (error) {
    console.error("❌ 试运行测试失败:", error);
  }
}

async function testBatchReencodeSpecificFolder() {
  try {
    console.log("\n🎯 测试指定文件夹的批量重编码（试运行）...");

    const folderName = "贾老师初联一轮"; // 你可以改成其他文件夹名称

    const response = await fetch(`${apiUrl}/videos/reencode/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dryRun: true,
        folderPath: folderName,
        maxConcurrent: 2
      })
    });

    console.log("响应状态:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ 指定文件夹试运行失败:", errorText);
      return;
    }

    const result = await response.json();
    console.log(`✅ 文件夹 "${folderName}" 试运行成功:`);
    console.log("📊 统计信息:", result.summary);

    if (result.videosToRecode && result.videosToRecode.length > 0) {
      console.log("🎬 该文件夹需要重编码的视频:");
      result.videosToRecode.forEach((video, index) => {
        console.log(`  ${index + 1}. ${video.path} (${(video.size / 1024 / 1024).toFixed(1)}MB)`);
      });
    }

  } catch (error) {
    console.error("❌ 指定文件夹试运行测试失败:", error);
  }
}

async function testActualBatchReencode() {
  console.log("\n⚠️  实际批量重编码测试");
  console.log("注意：这将真正执行重编码，可能消耗较长时间和AWS资源");
  console.log("建议先运行试运行模式了解情况");

  // 取消注释以下代码来实际执行批量重编码
  /*
  try {
    console.log("🚀 开始实际批量重编码...");

    const response = await fetch(`${apiUrl}/videos/reencode/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dryRun: false, // 实际执行
        folderPath: "", // 可以指定特定文件夹
        maxConcurrent: 2, // 降低并发数以避免超时
        forceReencode: false // 不强制重编码已有移动版本的视频
      })
    });

    console.log("响应状态:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ 批量重编码失败:", errorText);
      return;
    }

    const result = await response.json();
    console.log("✅ 批量重编码完成:");
    console.log("📊 处理结果:", result.summary);

    if (result.results && result.results.length > 0) {
      console.log("✅ 成功重编码的视频:");
      result.results.forEach((video, index) => {
        console.log(`  ${index + 1}. ${video.originalKey} -> ${video.mobileKey}`);
      });
    }

    if (result.errors && result.errors.length > 0) {
      console.log("❌ 重编码失败的视频:");
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.originalKey}: ${error.error}`);
      });
    }

    if (result.nextBatch) {
      console.log("⏭️  还有待处理视频:", result.nextBatch.message);
    }

  } catch (error) {
    console.error("❌ 实际批量重编码测试失败:", error);
  }
  */
}

async function main() {
  if (token === "YOUR_TOKEN_HERE") {
    console.log("❌ 请先设置有效的token");
    console.log("1. 在浏览器中打开你的视频系统");
    console.log("2. 在控制台运行: window.getCachedToken()");
    console.log("3. 复制token并替换脚本中的 YOUR_TOKEN_HERE");
    return;
  }

  // 运行测试序列
  await testBatchReencodeDryRun();
  await testBatchReencodeSpecificFolder();
  await testActualBatchReencode();

  console.log("\n🎉 测试完成！");
  console.log("📋 API用法总结:");
  console.log("- POST /videos/reencode/batch");
  console.log("- 参数: { dryRun, folderPath, maxConcurrent, forceReencode }");
  console.log("- dryRun: true=试运行（推荐先执行）, false=实际重编码");
  console.log("- folderPath: 空字符串=所有文件夹, 或指定文件夹名称");
  console.log("- maxConcurrent: 最大并发数（建议2-3）");
  console.log("- forceReencode: 是否强制重编码已有移动版本的视频");
}

main();