import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

// 检查文件是否存在
async function checkFileExists(videoKey) {
  try {
    const command = new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

// 调用format-converter API获取兼容性分析
async function getCompatibilityAnalysis(videoKey, authToken) {
  try {
    const FORMAT_CONVERTER_URL = process.env.FORMAT_CONVERTER_API_URL ||
      'https://s7tdbemrnaajemkt32mi3qhgvu0gocrb.lambda-url.ap-northeast-1.on.aws';

    console.log(`🔍 获取兼容性分析: ${videoKey}`);

    const response = await fetch(`${FORMAT_CONVERTER_URL}/convert/analyze/${encodeURIComponent(videoKey)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`⚠️  兼容性分析API调用失败: ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result.compatibilityAnalysis || null;
  } catch (error) {
    console.error(`❌ 兼容性分析获取失败: ${error.message}`);
    return null;
  }
}

export async function getVideoUrl(videoKey) {
  try {
    console.log("--- 生成视频URL ---");
    console.log("videoKey:", videoKey);

    // 生成预签名URL
    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    console.log("生成预签名URL成功");

    return createSuccessResponse({
      url: signedUrl,
      key: videoKey,
      expiresIn: 3600
    });

  } catch (error) {
    console.error("生成视频URL失败:", error);
    return createErrorResponse(500, "Failed to generate video URL", error.message);
  }
}

// 智能视频URL生成 - 包含兼容性分析和mobile版本信息
export async function getSmartVideoUrl(videoKey, authToken) {
  try {
    console.log("--- 智能视频URL生成 ---");
    console.log("videoKey:", videoKey);

    // 1. 检查原文件是否存在
    const originalExists = await checkFileExists(videoKey);
    if (!originalExists) {
      return createErrorResponse(404, "Video file not found", videoKey);
    }

    // 2. 生成原文件URL
    const originalCommand = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: videoKey,
    });
    const originalUrl = await getSignedUrl(s3Client, originalCommand, { expiresIn: 3600 });

    // 3. 检查mobile版本是否存在
    const mobileKey = videoKey.replace(/\.mp4$/i, '_mobile.mp4');
    const mobileExists = await checkFileExists(mobileKey);
    let mobileUrl = null;

    if (mobileExists) {
      const mobileCommand = new GetObjectCommand({
        Bucket: VIDEO_BUCKET,
        Key: mobileKey,
      });
      mobileUrl = await getSignedUrl(s3Client, mobileCommand, { expiresIn: 3600 });
      console.log("✅ 找到mobile版本");
    } else {
      console.log("📱 mobile版本不存在");
    }

    // 4. 获取兼容性分析
    const compatibility = await getCompatibilityAnalysis(videoKey, authToken);

    // 5. 构造智能响应
    const response = {
      original: {
        url: originalUrl,
        key: videoKey,
        exists: true
      },
      mobile: mobileExists ? {
        url: mobileUrl,
        key: mobileKey,
        exists: true
      } : {
        exists: false,
        key: mobileKey
      },
      compatibility: compatibility,
      expiresIn: 3600,
      recommendation: generatePlaybackRecommendation(compatibility, mobileExists)
    };

    console.log("✅ 智能URL生成完成");
    console.log(`📊 兼容性: ${compatibility ? compatibility.mobileCompatibility : '未知'}`);
    console.log(`📱 mobile版本: ${mobileExists ? '存在' : '不存在'}`);

    return createSuccessResponse(response);

  } catch (error) {
    console.error("智能视频URL生成失败:", error);
    return createErrorResponse(500, "Failed to generate smart video URL", error.message);
  }
}

// 生成播放建议
function generatePlaybackRecommendation(compatibility, hasMobileVersion) {
  if (!compatibility) {
    return {
      strategy: 'try_original_first',
      reason: '兼容性未知，建议先尝试原文件',
      fallback: hasMobileVersion ? 'mobile_available' : 'no_mobile'
    };
  }

  const isMobileCompatible = compatibility.mobileCompatibility === 'excellent';
  const needsMobile = compatibility.h264Analysis?.needsMobile;

  if (isMobileCompatible && !needsMobile) {
    return {
      strategy: 'original_preferred',
      reason: 'MOOV在前，移动端完全兼容',
      fallback: 'not_needed'
    };
  }

  if (!isMobileCompatible && hasMobileVersion) {
    return {
      strategy: 'mobile_preferred',
      reason: 'MOOV在后，建议移动端使用mobile版本',
      fallback: 'mobile_available'
    };
  }

  if (!isMobileCompatible && !hasMobileVersion) {
    return {
      strategy: 'needs_conversion',
      reason: 'MOOV在后且无mobile版本，需要转换',
      fallback: 'conversion_required'
    };
  }

  return {
    strategy: 'try_original_first',
    reason: '默认策略',
    fallback: hasMobileVersion ? 'mobile_available' : 'no_mobile'
  };
}