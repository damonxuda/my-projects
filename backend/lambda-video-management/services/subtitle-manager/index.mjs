import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyTokenAndCheckAccess, isAdmin as checkIsAdmin } from './shared/auth.mjs';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const translateClient = new TranslateClient({ region: process.env.AWS_REGION || 'us-east-1' });

// 管理员邮箱列表
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
const VIDEO_BUCKET = process.env.AWS_S3_VIDEO_BUCKET_NAME;

if (!VIDEO_BUCKET) {
  throw new Error("AWS_S3_VIDEO_BUCKET_NAME 环境变量未配置");
}

// Function URL已配置CORS，不需要在代码中设置CORS头

/**
 * 认证中间件 - 使用简化的JWT解码
 */
async function authenticateRequest(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    // 使用简化的JWT解码（不调用Clerk远程API）
    const user = await verifyTokenAndCheckAccess(token);

    if (!user) {
      throw new Error('Token verification failed');
    }

    const userEmail = user.emailAddresses?.[0]?.emailAddress;
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    return { user, isAdmin, userId: user.id };
  } catch (error) {
    console.error('Authentication failed:', error);
    throw new Error('Authentication failed');
  }
}

/**
 * 生成字幕 - 启动Transcribe任务（自动语言识别）
 */
async function generateSubtitle(event, auth) {
  // 前端控制权限，后端不检查
  console.log('📝 开始生成字幕...');

  const body = JSON.parse(event.body);
  const { videoKey } = body;
  console.log('📹 videoKey:', videoKey);

  if (!videoKey) {
    console.log('❌ videoKey缺失');
    return {
      statusCode: 400,
      // Function URL handles CORS
      body: JSON.stringify({ error: 'videoKey is required' })
    };
  }

  // 生成唯一的任务ID
  const timestamp = Date.now();
  const jobName = `subtitle-${videoKey.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}`;
  console.log('🎯 Job Name:', jobName);

  try {
    console.log('🚀 启动Transcribe任务（自动语言识别）...');
    // 启动Transcribe任务 - 使用自动语言识别
    const transcribeParams = {
      TranscriptionJobName: jobName,
      IdentifyLanguage: true, // 自动识别单一语言（从所有37种支持的语言中识别）
      Media: {
        MediaFileUri: `s3://${VIDEO_BUCKET}/${videoKey}`
      },
      OutputBucketName: VIDEO_BUCKET,
      OutputKey: `subtitles-temp/${jobName}/`,
      Subtitles: {
        Formats: ['srt', 'vtt'],
        OutputStartIndex: 1
      }
      // 不设置Settings和LanguageOptions，让AWS从所有支持的语言中自动识别
    };

    const command = new StartTranscriptionJobCommand(transcribeParams);
    const response = await transcribeClient.send(command);
    console.log('✅ Transcribe任务已启动:', jobName);

    // 保存任务元数据到S3（用于后续处理）
    const metadata = {
      jobName,
      videoKey,
      status: 'PROCESSING',
      createdAt: new Date().toISOString(),
      transcriptionJob: response.TranscriptionJob
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: `subtitles-jobs/${jobName}.json`,
      Body: JSON.stringify(metadata),
      ContentType: 'application/json'
    }));
    console.log('✅ 元数据已保存到S3');

    // 异步触发后台轮询和翻译（不等待）
    pollAndTranslate(jobName).catch(err => {
      console.error('❌ Background translation failed:', err);
      console.error('Error details:', JSON.stringify({
        message: err.message,
        stack: err.stack,
        name: err.name
      }));
    });

    return {
      statusCode: 200,
      // Function URL handles CORS
      body: JSON.stringify({
        success: true,
        jobName,
        jobId: jobName,
        message: '字幕生成任务已启动（自动识别语言）',
        estimatedTime: '5-15分钟'
      })
    };

  } catch (error) {
    console.error('❌ Failed to start transcription job:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    return {
      statusCode: 500,
      // Function URL handles CORS
      body: JSON.stringify({
        error: 'Failed to start subtitle generation',
        details: error.message
      })
    };
  }
}

/**
 * 查询字幕生成状态
 */
async function getSubtitleStatus(event, auth) {
  const jobName = event.queryStringParameters?.jobName;

  if (!jobName) {
    return {
      statusCode: 400,
      // Function URL handles CORS
      body: JSON.stringify({ error: 'jobName is required' })
    };
  }

  try {
    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    });

    const response = await transcribeClient.send(command);
    const job = response.TranscriptionJob;

    // 如果任务完成，触发翻译
    if (job.TranscriptionJobStatus === 'COMPLETED') {
      // 异步触发翻译（不等待）
      translateSubtitle(jobName).catch(err =>
        console.error('Translation trigger failed:', err)
      );
    }

    return {
      statusCode: 200,
      // Function URL handles CORS
      body: JSON.stringify({
        jobName,
        status: job.TranscriptionJobStatus,
        languageCode: job.LanguageCode,
        createdAt: job.CreationTime,
        completedAt: job.CompletionTime,
        subtitles: job.Subtitles
      })
    };

  } catch (error) {
    console.error('Failed to get transcription status:', error);
    return {
      statusCode: 500,
      // Function URL handles CORS
      body: JSON.stringify({
        error: 'Failed to get subtitle status',
        details: error.message
      })
    };
  }
}

/**
 * 轮询Transcribe任务并在完成后翻译
 */
async function pollAndTranslate(jobName) {
  console.log(`🔄 开始轮询任务状态: ${jobName}`);
  const maxAttempts = 30; // 最多30次，每次10秒，总共5分钟
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      console.log(`📊 轮询尝试 ${attempt + 1}/${maxAttempts} (已等待${elapsedSeconds}秒)`);

      const command = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName
      });
      const response = await transcribeClient.send(command);
      const job = response.TranscriptionJob;
      const status = job.TranscriptionJobStatus;

      console.log(`📊 任务状态: ${status}`, JSON.stringify({
        languageCode: job.LanguageCode,
        createdAt: job.CreationTime,
        completedAt: job.CompletionTime
      }));

      if (status === 'COMPLETED') {
        console.log('✅ 转录完成，开始翻译...');
        try {
          await translateSubtitle(jobName);
          console.log('✅ 翻译完成！');
        } catch (translateError) {
          console.error('❌ 翻译失败:', translateError);
          console.error('翻译错误详情:', JSON.stringify({
            message: translateError.message,
            stack: translateError.stack
          }));
          throw translateError;
        }
        return;
      } else if (status === 'FAILED') {
        const failureReason = job.FailureReason || 'Unknown';
        console.error('❌ Transcribe任务失败:', failureReason);
        throw new Error(`Transcription failed: ${failureReason}`);
      }

      // 等待10秒再检查
      if (attempt < maxAttempts - 1) {
        console.log('⏳ 等待10秒后继续轮询...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (error) {
      console.error(`❌ 轮询错误 (尝试 ${attempt + 1}):`, error);
      console.error('错误详情:', JSON.stringify({
        message: error.message,
        name: error.name,
        code: error.code
      }));

      // 如果是AWS API错误，不继续轮询
      if (error.name === 'ResourceNotFoundException' || error.name === 'BadRequestException') {
        throw error;
      }

      // 其他错误继续尝试
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  console.log('⚠️ 轮询超时，任务可能仍在进行');
  throw new Error('Polling timeout: Job may still be in progress');
}

/**
 * 翻译字幕文件
 */
async function translateSubtitle(jobName) {
  console.log(`🌍 开始翻译字幕: ${jobName}`);

  try {
    // 1. 获取任务元数据
    console.log('📋 步骤1: 获取任务元数据...');
    const metadataResponse = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: `subtitles-jobs/${jobName}.json`
    }));

    const metadata = JSON.parse(await metadataResponse.Body.transformToString());
    const { videoKey } = metadata;
    console.log(`📹 videoKey: ${videoKey}`);

    // 2. 从Transcribe job获取识别出的语言
    console.log('🔍 步骤2: 获取识别的语言...');
    const jobResponse = await transcribeClient.send(new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName
    }));
    const detectedLanguage = jobResponse.TranscriptionJob.LanguageCode;
    console.log(`🌐 检测到的语言: ${detectedLanguage}`);

    // 3. 获取Transcribe生成的SRT字幕
    console.log('📥 步骤3: 从S3获取原始SRT字幕...');
    const srtKey = `subtitles-temp/${jobName}/${jobName}.srt`;
    console.log(`📂 SRT Key: ${srtKey}`);

    const srtResponse = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: srtKey
    }));

    const originalSrt = await srtResponse.Body.transformToString();
    console.log(`✅ 原始SRT大小: ${originalSrt.length} 字节`);

    // 4. 解析SRT并翻译文本
    console.log('🔄 步骤4: 开始翻译SRT内容...');
    const translatedSrt = await translateSrtContent(originalSrt, detectedLanguage);
    console.log(`✅ 翻译完成，大小: ${translatedSrt.length} 字节`);

    // 5. 保存字幕文件
    console.log('💾 步骤5: 保存字幕文件到S3...');
    const subtitleDir = `subtitles/${videoKey}`;

    // 保存原语言字幕
    const originalKey = `${subtitleDir}/${detectedLanguage}.srt`;
    console.log(`📤 保存原语言字幕: ${originalKey}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: originalKey,
      Body: originalSrt,
      ContentType: 'text/plain; charset=utf-8'
    }));
    console.log(`✅ 原语言字幕已保存`);

    // 保存中文字幕
    const chineseKey = `${subtitleDir}/zh-CN.srt`;
    console.log(`📤 保存中文字幕: ${chineseKey}`);
    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: chineseKey,
      Body: translatedSrt,
      ContentType: 'text/plain; charset=utf-8'
    }));
    console.log(`✅ 中文字幕已保存`);

    // 6. 更新任务状态
    metadata.status = 'COMPLETED';
    metadata.completedAt = new Date().toISOString();
    metadata.detectedLanguage = detectedLanguage;
    metadata.subtitles = {
      original: `${subtitleDir}/${detectedLanguage}.srt`,
      chinese: `${subtitleDir}/zh-CN.srt`
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: `subtitles-jobs/${jobName}.json`,
      Body: JSON.stringify(metadata),
      ContentType: 'application/json'
    }));

    console.log(`✅ Subtitle translation completed for ${videoKey} (detected: ${detectedLanguage})`);
    return { success: true };

  } catch (error) {
    console.error('Translation failed:', error);
    throw error;
  }
}

/**
 * 翻译SRT内容
 */
async function translateSrtContent(srtContent, sourceLanguage) {
  // 解析SRT格式
  const subtitleBlocks = srtContent.split('\n\n').filter(block => block.trim());
  const translatedBlocks = [];

  for (const block of subtitleBlocks) {
    const lines = block.split('\n');

    if (lines.length < 3) {
      translatedBlocks.push(block);
      continue;
    }

    const index = lines[0];
    const timestamp = lines[1];
    const text = lines.slice(2).join('\n');

    // 翻译文本
    try {
      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLanguage.split('-')[0], // ja-JP -> ja
        TargetLanguageCode: 'zh'
      });

      const response = await translateClient.send(command);
      const translatedText = response.TranslatedText;

      translatedBlocks.push(`${index}\n${timestamp}\n${translatedText}`);

    } catch (error) {
      console.error('Translation error for block:', error);
      // 如果翻译失败，保留原文
      translatedBlocks.push(block);
    }

    // 避免超过AWS Translate限速
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return translatedBlocks.join('\n\n');
}

/**
 * 获取字幕文件内容（直接返回文件，支持URL token认证）
 */
async function getSubtitle(event) {
  const videoKey = event.queryStringParameters?.videoKey;
  const lang = event.queryStringParameters?.lang;
  const token = event.queryStringParameters?.token;

  if (!videoKey || !lang) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'videoKey and lang are required' })
    };
  }

  // 验证token（支持URL参数token）
  if (!token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'token is required' })
    };
  }

  try {
    // 验证token
    const user = await verifyTokenAndCheckAccess(token);
    if (!user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    const key = `subtitles/${videoKey}/${lang}.srt`;
    const command = new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: key
    });

    const response = await s3Client.send(command);
    const content = await response.Body.transformToString();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': 'https://damonxuda.site',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: content
    };

  } catch (error) {
    console.error('Failed to get subtitle:', error);
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Subtitle not found',
        details: error.message
      })
    };
  }
}

/**
 * 列出视频的字幕文件
 */
async function listSubtitles(event, auth) {
  const videoKey = event.queryStringParameters?.videoKey;
  console.log('📋 列出字幕 - videoKey:', videoKey);

  if (!videoKey) {
    console.log('❌ videoKey缺失');
    return {
      statusCode: 400,
      // Function URL handles CORS
      body: JSON.stringify({ error: 'videoKey is required' })
    };
  }

  try {
    const prefix = `subtitles/${videoKey}/`;
    console.log('🔍 S3 prefix:', prefix);

    const command = new ListObjectsV2Command({
      Bucket: VIDEO_BUCKET,
      Prefix: prefix
    });

    const response = await s3Client.send(command);
    console.log('📦 S3 response:', JSON.stringify({
      Contents: response.Contents?.length || 0,
      keys: response.Contents?.map(c => c.Key) || []
    }));

    if (!response.Contents || response.Contents.length === 0) {
      console.log('❌ 未找到字幕文件');
      return {
        statusCode: 404,
        // Function URL handles CORS
        body: JSON.stringify({
          videoKey,
          subtitles: {},
          message: 'No subtitles found'
        })
      };
    }

    console.log(`✅ 找到 ${response.Contents.length} 个字幕文件`);

    // 使用Lambda URL而不是S3预签名URL
    // 从请求中获取当前Lambda的URL
    const currentHost = event.requestContext?.domainName || event.headers?.host || event.headers?.Host;
    const SUBTITLE_API_URL = currentHost ? `https://${currentHost}` : process.env.SUBTITLE_API_URL;

    if (!SUBTITLE_API_URL) {
      throw new Error('无法确定SUBTITLE_API_URL，请设置环境变量');
    }

    const subtitles = {};

    for (const object of response.Contents) {
      const key = object.Key;
      const filename = key.split('/').pop();
      const lang = filename.replace('.srt', '');

      // 使用Lambda代理URL
      subtitles[lang] = `${SUBTITLE_API_URL}/subtitles/get?videoKey=${encodeURIComponent(videoKey)}&lang=${encodeURIComponent(lang)}`;
    }

    return {
      statusCode: 200,
      // Function URL handles CORS
      body: JSON.stringify({
        videoKey,
        subtitles
      })
    };

  } catch (error) {
    console.error('Failed to list subtitles:', error);
    return {
      statusCode: 500,
      // Function URL handles CORS
      body: JSON.stringify({
        error: 'Failed to list subtitles',
        details: error.message
      })
    };
  }
}

/**
 * 主处理函数
 */
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // 处理OPTIONS请求（CORS预检）
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      // Function URL handles CORS
      body: ''
    };
  }

  // 路由处理
  const path = event.rawPath || event.path || '';
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';

  console.log(`Route: ${method} ${path}`);

  // GET /subtitles/get - 获取字幕文件内容（不需要预先认证，内部验证token）
  if (method === 'GET' && path.includes('/subtitles/get')) {
    return await getSubtitle(event);
  }

  try {
    // 其他路由需要认证
    const auth = await authenticateRequest(event);

    // POST /subtitles/generate - 生成字幕
    if (method === 'POST' && path.includes('/subtitles/generate')) {
      return await generateSubtitle(event, auth);
    }

    // GET /subtitles/status - 查询状态
    if (method === 'GET' && path.includes('/subtitles/status')) {
      return await getSubtitleStatus(event, auth);
    }

    // GET /subtitles/list - 列出字幕
    if (method === 'GET' && path.includes('/subtitles/list')) {
      return await listSubtitles(event, auth);
    }

    // 未知路由
    return {
      statusCode: 404,
      // Function URL handles CORS
      body: JSON.stringify({ error: 'Route not found' })
    };

  } catch (error) {
    console.error('Request failed:', error);

    if (error.message.includes('Authentication')) {
      return {
        statusCode: 401,
        // Function URL handles CORS
        body: JSON.stringify({ error: 'Unauthorized', details: error.message })
      };
    }

    return {
      statusCode: 500,
      // Function URL handles CORS
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
