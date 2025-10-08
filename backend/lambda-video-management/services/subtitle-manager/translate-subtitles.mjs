import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const s3 = new S3Client({ region: 'ap-northeast-1' });
const translate = new TranslateClient({ region: 'ap-northeast-1' });

async function translateSrt(srtContent, sourceLang) {
  const blocks = srtContent.split('\n\n').filter(b => b.trim());
  const translated = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n');
    if (lines.length < 3) {
      translated.push(blocks[i]);
      continue;
    }

    const [index, time, ...textLines] = lines;
    const text = textLines.join('\n');

    try {
      const result = await translate.send(new TranslateTextCommand({
        Text: text,
        SourceLanguageCode: sourceLang.split('-')[0],
        TargetLanguageCode: 'zh'
      }));

      translated.push(`${index}\n${time}\n${result.TranslatedText}`);

      if ((i + 1) % 10 === 0) {
        console.log(`  进度: ${i + 1}/${blocks.length}`);
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`❌ Block ${index}:`, e.message);
      translated.push(blocks[i]);
    }
  }

  return translated.join('\n\n');
}

async function main() {
  const videos = [
    { key: 'videos/Movies/61to.mp4', lang: 'de-DE' },
    { key: 'videos/Movies/s@scene.mp4', lang: 'en-US' }
  ];

  for (const v of videos) {
    console.log(`\n📹 ${v.key}`);
    const srcKey = `subtitles/${v.key}/${v.lang}.srt`;

    console.log('📥 下载原文...');
    const obj = await s3.send(new GetObjectCommand({
      Bucket: 'damonxuda-video-files',
      Key: srcKey
    }));
    const original = await obj.Body.transformToString();
    console.log(`✅ ${original.length} 字节`);

    console.log('🔄 翻译中...');
    const translated = await translateSrt(original, v.lang);
    console.log(`✅ ${translated.length} 字节`);

    const dstKey = `subtitles/${v.key}/zh-CN.srt`;
    console.log('📤 上传译文...');
    await s3.send(new PutObjectCommand({
      Bucket: 'damonxuda-video-files',
      Key: dstKey,
      Body: translated,
      ContentType: 'text/plain; charset=utf-8'
    }));
    console.log(`✅ ${dstKey}`);
  }

  console.log('\n🎉 完成！');
}

main().catch(console.error);
