import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyTokenAndCheckAccess, isAdmin as checkIsAdmin } from './shared/auth.mjs';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const transcribeClient = new TranscribeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' });

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

    // S3事件通知会自动触发翻译，不需要在这里轮询
    console.log('💡 Transcribe完成后，S3事件将自动触发翻译');

    return {
      statusCode: 200,
      // Function URL handles CORS
      body: JSON.stringify({
        success: true,
        jobName,
        jobId: jobName,
        message: '字幕生成任务已启动（自动识别语言），完成后将自动翻译为中文',
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
 * 手动翻译已存在的字幕文件
 */
async function translateExistingSubtitle(videoKey, sourceLang) {
  console.log(`🌍 手动翻译字幕: ${videoKey} (${sourceLang} -> zh-CN)`);

  try {
    // 1. 读取原字幕
    const sourceKey = `subtitles/${videoKey}/${sourceLang}.srt`;
    console.log(`📥 读取原字幕: ${sourceKey}`);

    const srtResponse = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: sourceKey
    }));

    const originalSrt = await srtResponse.Body.transformToString();
    console.log(`✅ 原始SRT大小: ${originalSrt.length} 字节`);

    // 2. 翻译
    console.log('🔄 开始翻译...');
    const translatedSrt = await translateSrtContent(originalSrt, sourceLang);
    console.log(`✅ 翻译完成，大小: ${translatedSrt.length} 字节`);

    // 3. 保存中文字幕
    const chineseKey = `subtitles/${videoKey}/zh-CN.srt`;
    console.log(`📤 保存中文字幕: ${chineseKey}`);

    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: chineseKey,
      Body: translatedSrt,
      ContentType: 'text/plain; charset=utf-8'
    }));

    console.log(`✅ ${videoKey} 中文字幕生成完成！`);
    return { success: true, chineseKey };

  } catch (error) {
    console.error('❌ 翻译失败:', error);
    throw error;
  }
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
 * 使用Claude翻译文本
 */
async function translateWithClaude(texts, sourceLanguage) {
  const prompt = `请将以下${sourceLanguage}字幕翻译成简体中文。要求：
1. 保持口语化和自然
2. 准确传达原意
3. 使用日常用语，避免生硬
4. 每行一个翻译结果，顺序不变

原文：
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

翻译：`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const translatedText = responseBody.content[0].text;

    // 解析Claude的响应，提取翻译结果
    const lines = translatedText.split('\n').filter(l => l.trim());
    const translations = [];

    for (const line of lines) {
      // 匹配 "1. 译文" 或 "译文" 格式
      const match = line.match(/^\d+\.\s*(.+)$/) || [null, line.trim()];
      if (match[1]) {
        translations.push(match[1]);
      }
    }

    return translations;
  } catch (error) {
    console.error('Claude translation error:', error);
    throw error;
  }
}

/**
 * 翻译SRT内容（使用Claude批量翻译）
 */
async function translateSrtContent(srtContent, sourceLanguage) {
  console.log('🤖 使用Claude 3.5 Sonnet翻译...');

  const subtitleBlocks = srtContent.split('\n\n').filter(block => block.trim());
  const translatedBlocks = [];
  const batchSize = 5; // 每次翻译5条字幕

  for (let i = 0; i < subtitleBlocks.length; i += batchSize) {
    const batch = subtitleBlocks.slice(i, i + batchSize);
    const texts = [];
    const blockInfo = [];

    // 提取文本
    for (const block of batch) {
      const lines = block.split('\n');
      if (lines.length < 3) {
        blockInfo.push({ index: lines[0], timestamp: lines[1], text: '', skip: true });
        continue;
      }

      const index = lines[0];
      const timestamp = lines[1];
      const text = lines.slice(2).join('\n');

      blockInfo.push({ index, timestamp, text, skip: false });
      texts.push(text);
    }

    try {
      // 批量翻译
      const translations = await translateWithClaude(texts, sourceLanguage);

      // 组装结果
      let translationIndex = 0;
      for (const info of blockInfo) {
        if (info.skip) {
          translatedBlocks.push(`${info.index}\n${info.timestamp}\n`);
        } else {
          const translatedText = translations[translationIndex] || info.text;
          translatedBlocks.push(`${info.index}\n${info.timestamp}\n${translatedText}`);
          translationIndex++;
        }
      }

      if ((i + batchSize) % 20 === 0) {
        console.log(`  进度: ${Math.min(i + batchSize, subtitleBlocks.length)}/${subtitleBlocks.length}`);
      }

      // 避免过快调用API
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`Translation error for batch ${i}:`, error);
      // 如果翻译失败，保留原文
      for (const info of blockInfo) {
        translatedBlocks.push(`${info.index}\n${info.timestamp}\n${info.text}`);
      }
    }
  }

  console.log('✅ Claude翻译完成');
  return translatedBlocks.join('\n\n');
}

/**
 * 将SRT格式转换为WebVTT格式
 */
function convertSrtToVtt(srtContent) {
  // 将时间戳中的逗号替换为点号
  // SRT: 00:00:08,060 --> 00:00:08,430
  // VTT: 00:00:08.060 --> 00:00:08.430
  let vttContent = srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  // 在文件开头添加WEBVTT标识
  vttContent = 'WEBVTT\n\n' + vttContent;

  return vttContent;
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
    let content = await response.Body.transformToString();

    // 将SRT转换为WebVTT格式（浏览器<track>元素只支持VTT）
    content = convertSrtToVtt(content);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
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

  // 检查是否是S3事件（Transcribe完成后的通知）
  if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
    console.log('📨 收到S3事件通知');

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`📂 S3事件: ${bucket}/${key}`);

      // 只处理subtitles-temp目录下的.srt文件（Transcribe输出）
      if (key.startsWith('subtitles-temp/') && key.endsWith('.srt')) {
        const jobName = key.split('/')[1]; // 提取jobName
        console.log(`🎯 检测到Transcribe输出，jobName: ${jobName}`);

        try {
          await translateSubtitle(jobName);
          console.log(`✅ 字幕翻译完成: ${jobName}`);
        } catch (error) {
          console.error(`❌ 翻译失败: ${jobName}`, error);
        }
      }
    }

    return { statusCode: 200, body: 'Processed' };
  }

  // 直接调用模式（用于管理任务，绕过API认证）
  if (event.directInvoke === true && event.action === 'translate') {
    console.log('📝 直接调用模式: 翻译字幕');
    const { videoKey, sourceLang } = event;

    if (!videoKey || !sourceLang) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'videoKey and sourceLang are required' })
      };
    }

    try {
      const result = await translateExistingSubtitle(videoKey, sourceLang);
      return {
        statusCode: 200,
        body: JSON.stringify(result)
      };
    } catch (error) {
      console.error('❌ 直接调用翻译失败:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message, stack: error.stack })
      };
    }
  }

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

    // POST /subtitles/translate - 手动翻译已存在的字幕
    if (method === 'POST' && path.includes('/subtitles/translate')) {
      const body = JSON.parse(event.body);
      const { videoKey, sourceLang } = body;

      if (!videoKey || !sourceLang) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'videoKey and sourceLang are required' })
        };
      }

      try {
        const result = await translateExistingSubtitle(videoKey, sourceLang);
        return {
          statusCode: 200,
          body: JSON.stringify(result)
        };
      } catch (error) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: error.message })
        };
      }
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
