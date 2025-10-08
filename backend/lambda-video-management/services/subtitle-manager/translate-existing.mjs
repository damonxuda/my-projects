// 临时脚本：为现有字幕生成中文译文
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const s3Client = new S3Client({ region: 'ap-northeast-1' });
const translateClient = new TranslateClient({ region: 'ap-northeast-1' });
const VIDEO_BUCKET = 'damonxuda-video-files';

// 翻译SRT内容
async function translateSrtContent(srtContent, sourceLanguage) {
  console.log(`🔄 开始翻译 (${sourceLanguage} -> zh)...`);

  const subtitleBlocks = srtContent.split('\n\n').filter(block => block.trim());
  const translatedBlocks = [];

  for (let i = 0; i < subtitleBlocks.length; i++) {
    const block = subtitleBlocks[i];
    const lines = block.split('\n');

    if (lines.length < 3) {
      translatedBlocks.push(block);
      continue;
    }

    const index = lines[0];
    const timestamp = lines[1];
    const text = lines.slice(2).join('\n');

    try {
      const command = new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLanguage.split('-')[0], // de-DE -> de
        TargetLanguageCode: 'zh'
      });

      const response = await translateClient.send(command);
      const translatedText = response.TranslatedText;

      translatedBlocks.push(`${index}\n${timestamp}\n${translatedText}`);

      if ((i + 1) % 10 === 0) {
        console.log(`  进度: ${i + 1}/${subtitleBlocks.length}`);
      }

      // 避免超过AWS Translate限速
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`翻译失败 (block ${index}):`, error.message);
      translatedBlocks.push(block);
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
