// 临时脚本：为现有字幕生成中文译文（使用Claude）
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const s3Client = new S3Client({ region: 'ap-northeast-1' });
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-1' });
const VIDEO_BUCKET = 'damonxuda-video-files';

// 使用Claude翻译一批文本
async function translateWithClaude(texts, sourceLanguage) {
  const languageMap = {
    'de': '德语',
    'en': '英语',
    'ja': '日语',
    'es': '西班牙语',
    'fr': '法语'
  };

  const langCode = sourceLanguage.split('-')[0];
  const langName = languageMap[langCode] || sourceLanguage;

  const prompt = `请将以下${langName}字幕翻译成简体中文。要求：
1. 保持口语化和自然
2. 准确传达原意
3. 使用日常用语，避免生硬的直译
4. 每行一个翻译结果，顺序不变

字幕内容：
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}

请只返回翻译结果，每行一个，不要包含序号。`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const translatedText = responseBody.content[0].text;

    return translatedText.split('\n').filter(line => line.trim());
  } catch (error) {
    console.error('Claude翻译失败:', error.message);
    throw error;
  }
}

// 翻译SRT内容
async function translateSrtContent(srtContent, sourceLanguage) {
  console.log(`🔄 开始使用Claude翻译 (${sourceLanguage} -> zh)...`);

  const subtitleBlocks = srtContent.split('\n\n').filter(block => block.trim());
  const translatedBlocks = [];

  // 批量处理，每次5条
  const BATCH_SIZE = 5;

  for (let i = 0; i < subtitleBlocks.length; i += BATCH_SIZE) {
    const batch = subtitleBlocks.slice(i, Math.min(i + BATCH_SIZE, subtitleBlocks.length));
    const texts = [];
    const blockData = [];

    for (const block of batch) {
      const lines = block.split('\n');
      if (lines.length < 3) {
        blockData.push({ skip: true, block });
        continue;
      }

      const index = lines[0];
      const timestamp = lines[1];
      const text = lines.slice(2).join('\n');

      blockData.push({ index, timestamp, text });
      texts.push(text);
    }

    if (texts.length > 0) {
      try {
        const translations = await translateWithClaude(texts, sourceLanguage);

        let textIndex = 0;
        for (const data of blockData) {
          if (data.skip) {
            translatedBlocks.push(data.block);
          } else {
            const translatedText = translations[textIndex] || data.text;
            translatedBlocks.push(`${data.index}\n${data.timestamp}\n${translatedText}`);
            textIndex++;
          }
        }

        console.log(`  进度: ${Math.min(i + BATCH_SIZE, subtitleBlocks.length)}/${subtitleBlocks.length}`);

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`批次翻译失败 (${i}-${i + BATCH_SIZE}):`, error.message);
        // 失败时保留原文
        for (const data of blockData) {
          if (data.skip) {
            translatedBlocks.push(data.block);
          } else {
            translatedBlocks.push(`${data.index}\n${data.timestamp}\n${data.text}`);
          }
        }
      }
    } else {
      for (const data of blockData) {
        translatedBlocks.push(data.block);
      }
    }
  }

  console.log(`✅ 翻译完成: ${subtitleBlocks.length} 条字幕`);
  return translatedBlocks.join('\n\n');
}

// 处理单个视频
async function translateSubtitle(videoKey, sourceLang) {
  console.log(`\n📹 处理视频: ${videoKey}`);
  console.log(`   源语言: ${sourceLang}`);

  try {
    // 1. 读取原文字幕
    const sourceKey = `subtitles/${videoKey}/${sourceLang}.srt`;
    console.log(`📥 下载字幕: ${sourceKey}`);

    const getResponse = await s3Client.send(new GetObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: sourceKey
    }));

    const originalSrt = await getResponse.Body.transformToString();
    console.log(`✅ 原文字幕大小: ${originalSrt.length} 字节`);

    // 2. 翻译
    const translatedSrt = await translateSrtContent(originalSrt, sourceLang);
    console.log(`✅ 译文字幕大小: ${translatedSrt.length} 字节`);

    // 3. 保存中文字幕
    const chineseKey = `subtitles/${videoKey}/zh-CN.srt`;
    console.log(`📤 上传中文字幕: ${chineseKey}`);

    await s3Client.send(new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: chineseKey,
      Body: translatedSrt,
      ContentType: 'text/plain; charset=utf-8'
    }));

    console.log(`✅ ${videoKey} 中文字幕生成完成！`);
    return true;

  } catch (error) {
    console.error(`❌ 处理失败: ${error.message}`);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始为现有视频生成中文译文...\n');

  const videos = [
    { key: 'videos/Movies/61to.mp4', lang: 'de-DE' },
    { key: 'videos/Movies/s@scene.mp4', lang: 'en-US' }
  ];

  for (const video of videos) {
    await translateSubtitle(video.key, video.lang);
  }

  console.log('\n🎉 全部完成！');
}

main().catch(console.error);
