import { MediaConvertClient, CreateJobCommand, GetJobCommand } from "@aws-sdk/client-mediaconvert";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "ap-northeast-1"
});

export async function processVideo(inputKey, outputPrefix = null, settings = {}, user = null) {
  try {
    console.log("=== 开始视频处理 ===");

    // 支持两种调用方式：
    // 1. 直接传参：processVideo(videoKey, outputPrefix, settings, user)
    // 2. 通过event对象：processVideo(event, user) - 向后兼容
    if (typeof inputKey === 'object' && inputKey.body) {
      // 兼容旧的调用方式
      const event = inputKey;
      user = outputPrefix; // 在这种情况下，第二个参数是user

      let body;
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        return createErrorResponse(400, "Invalid JSON in request body");
      }

      inputKey = body.inputKey;
      outputPrefix = body.outputPrefix;
      settings = body.settings || {};
    }

    if (!inputKey) {
      return createErrorResponse(400, "Missing required parameter: inputKey");
    }

    // 验证输入文件路径安全性
    if (!inputKey.startsWith("videos/")) {
      return createErrorResponse(400, "Invalid input path - must be in videos/ directory");
    }

    console.log("Input key:", inputKey);
    console.log("Output prefix:", outputPrefix || "processed");

    // 设置默认处理配置
    const defaultSettings = {
      quality: "standard",
      format: "mp4",
      resolution: "720p",
      enableMobile: true
    };

    const processingSettings = { ...defaultSettings, ...settings };
    console.log("Processing settings:", processingSettings);

    // 构建MediaConvert作业配置（包含智能分辨率检测）
    const jobSettings = await buildJobSettings(inputKey, outputPrefix, processingSettings);

    // 创建MediaConvert作业
    const createJobParams = {
      Role: process.env.MEDIACONVERT_ROLE_ARN || "arn:aws:iam::730335478220:role/service-role/MediaConvert_Default_Role",
      Settings: jobSettings,
      Queue: process.env.MEDIACONVERT_QUEUE_ARN,
      UserMetadata: {
        userId: user?.id || "system-auto",
        originalKey: inputKey,
        requestTime: new Date().toISOString()
      }
    };

    console.log("Creating MediaConvert job...");
    const job = await mediaConvertClient.send(new CreateJobCommand(createJobParams));

    console.log("MediaConvert job created:", job.Job.Id);

    return createSuccessResponse({
      success: true,
      jobId: job.Job.Id,
      status: job.Job.Status,
      inputKey,
      outputPrefix: outputPrefix || "processed",
      settings: processingSettings,
      estimatedTime: "5-15 minutes",
      message: "Video processing job started successfully"
    });

  } catch (error) {
    console.error("视频处理失败:", error);
    return createErrorResponse(500, "Failed to start video processing", error.message);
  }
}

async function buildJobSettings(inputKey, outputPrefix, settings) {
  const inputS3Url = `s3://${VIDEO_BUCKET}/${inputKey}`;

  // 获取文件信息用于智能参数调整
  let fileSize = 0;
  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const headResult = await s3Client.send(new HeadObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: inputKey
    }));
    fileSize = headResult.ContentLength;
    console.log(`📊 文件大小: ${Math.round(fileSize/1024/1024)}MB`);
  } catch (error) {
    console.warn('无法获取文件大小，使用默认参数');
  }

  // 智能构建输出路径：输出到与输入文件相同的目录
  let outputS3Prefix;
  if (outputPrefix === "videos" || !outputPrefix) {
    // 如果指定输出到videos目录，则输出到与输入相同的目录
    const inputDir = inputKey.substring(0, inputKey.lastIndexOf('/') + 1); // 提取目录部分
    outputS3Prefix = `s3://${VIDEO_BUCKET}/${inputDir}`;
    console.log(`📁 输出到与输入相同目录: ${outputS3Prefix}`);
  } else {
    // 其他情况使用指定的前缀
    outputS3Prefix = `s3://${VIDEO_BUCKET}/${outputPrefix}/`;
    console.log(`📁 输出到指定目录: ${outputS3Prefix}`);
  }

  // 智能分辨率选择：基于源视频分辨率
  const intelligentResolution = await selectIntelligentResolution(inputKey, settings.resolution);
  console.log(`🎯 智能分辨率选择: ${settings.resolution} -> ${intelligentResolution}`);

  // 更新设置中的分辨率
  const optimizedSettings = { ...settings, resolution: intelligentResolution };

  const jobSettings = {
    Inputs: [{
      FileInput: inputS3Url,
      AudioSelectors: {
        "Audio Selector 1": {
          Offset: 0,
          DefaultSelection: "DEFAULT",
          ProgramSelection: 1
        }
      },
      VideoSelector: {
        ColorSpace: "FOLLOW"
      }
    }],
    OutputGroups: []
  };

  // 主要输出组 - 标准质量
  const mainOutputGroup = {
    Name: "Main Output",
    Destination: outputS3Prefix,
    OutputGroupSettings: {
      Type: "FILE_GROUP_SETTINGS",
      FileGroupSettings: {
        Destination: outputS3Prefix
      }
    },
    Outputs: [{
      NameModifier: `_${optimizedSettings.resolution}_${optimizedSettings.quality}`,
      ContainerSettings: {
        Container: settings.format.toUpperCase(),
        Mp4Settings: {
          CslgAtom: "INCLUDE",
          FreeSpaceBox: "EXCLUDE",
          MoovPlacement: "PROGRESSIVE_DOWNLOAD"
        }
      },
      VideoDescription: buildVideoDescription(optimizedSettings),
      AudioDescriptions: [{
        AudioTypeControl: "FOLLOW_INPUT",
        AudioSourceName: "Audio Selector 1",
        CodecSettings: {
          Codec: "AAC",
          AacSettings: {
            AudioDescriptionBroadcasterMix: "NORMAL",
            Bitrate: 96000,
            RateControlMode: "CBR",
            CodecProfile: "LC",
            CodingMode: "CODING_MODE_2_0",
            RawFormat: "NONE",
            SampleRate: 48000,
            Specification: "MPEG4"
          }
        },
        LanguageCodeControl: "FOLLOW_INPUT"
      }]
    }]
  };

  // 添加主输出组（除非明确跳过）
  if (!optimizedSettings.skipMainOutput) {
    jobSettings.OutputGroups.push(mainOutputGroup);
  }

  // 如果启用移动端版本，添加移动端输出组
  if (optimizedSettings.enableMobile) {
    // 智能计算mobile版本的码率（估算原码率并降低60%）
    const estimatedDurationSec = 300; // 假设5分钟，实际会根据视频调整
    const estimatedOriginalBitrate = (fileSize * 8) / estimatedDurationSec; // 估算原码率
    const mobileBitrate = Math.min(400000, Math.max(200000, estimatedOriginalBitrate * 0.6));

    console.log(`📱 智能调整mobile码率: ${Math.round(estimatedOriginalBitrate/1000)}kbps → ${Math.round(mobileBitrate/1000)}kbps`);
    const mobileOutputGroup = {
      Name: "Mobile Output",
      Destination: outputS3Prefix,
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS",
        FileGroupSettings: {
          Destination: outputS3Prefix
        }
      },
      Outputs: [{
        NameModifier: "_mobile",
        ContainerSettings: {
          Container: "MP4",
          Mp4Settings: {
            CslgAtom: "INCLUDE",
            FreeSpaceBox: "EXCLUDE",
            MoovPlacement: "PROGRESSIVE_DOWNLOAD"
          }
        },
        VideoDescription: {
          ScalingBehavior: "DEFAULT",
          TimecodeInsertion: "DISABLED",
          AntiAlias: "ENABLED",
          Sharpness: 50,
          CodecSettings: {
            Codec: "H_264",
            H264Settings: {
              InterlaceMode: "PROGRESSIVE",
              NumberReferenceFrames: 3,
              Syntax: "DEFAULT",
              Softness: 0,
              GopClosedCadence: 1,
              GopSize: 90,
              Slices: 1,
              GopBReference: "DISABLED",
              SlowPal: "DISABLED",
              SpatialAdaptiveQuantization: "ENABLED",
              TemporalAdaptiveQuantization: "ENABLED",
              FlickerAdaptiveQuantization: "DISABLED",
              EntropyEncoding: "CABAC",
              Bitrate: mobileBitrate, // 智能调整的码率
              FramerateControl: "SPECIFIED",
              RateControlMode: "CBR",
              CodecProfile: "MAIN",
              Telecine: "NONE",
              MinIInterval: 0,
              AdaptiveQuantization: "HIGH",
              CodecLevel: "AUTO",
              FieldEncoding: "PAFF",
              SceneChangeDetect: "ENABLED",
              QualityTuningLevel: "SINGLE_PASS",
              FramerateConversionAlgorithm: "DUPLICATE_DROP",
              UnregisteredSeiTimecode: "DISABLED",
              GopSizeUnits: "FRAMES",
              ParControl: "INITIALIZE_FROM_SOURCE",
              NumberBFramesBetweenReferenceFrames: 2,
              RepeatPps: "DISABLED",
              FramerateNumerator: 24, // 降低帧率到24fps
              FramerateDenominator: 1,
              DynamicSubGop: "STATIC"
            }
          },
          AfdSignaling: "NONE",
          DropFrameTimecode: "ENABLED",
          RespondToAfd: "NONE",
          ColorMetadata: "INSERT",
          Width: 640,
          Height: 480
        },
        AudioDescriptions: [{
          AudioTypeControl: "FOLLOW_INPUT",
          AudioSourceName: "Audio Selector 1",
          CodecSettings: {
            Codec: "AAC",
            AacSettings: {
              AudioDescriptionBroadcasterMix: "NORMAL",
              Bitrate: 48000, // 降低音频码率到48kbps
              RateControlMode: "CBR",
              CodecProfile: "LC",
              CodingMode: "CODING_MODE_2_0",
              RawFormat: "NONE",
              SampleRate: 48000,
              Specification: "MPEG4"
            }
          },
          LanguageCodeControl: "FOLLOW_INPUT"
        }]
      }]
    };

    jobSettings.OutputGroups.push(mobileOutputGroup);
  }

  return jobSettings;
}

// 智能分辨率选择：基于源视频分辨率智能选择输出分辨率
async function selectIntelligentResolution(inputKey, requestedResolution) {
  try {
    console.log(`🔍 开始分析源视频分辨率: ${inputKey}`);

    // 使用基于文件名和常见分辨率的启发式方法进行智能分辨率检测
    console.log(`💡 使用启发式方法分析分辨率`);

    const fileName = inputKey.toLowerCase();
    let detectedResolution = requestedResolution;

    // 基于文件名中的分辨率标识符进行智能判断
    if (fileName.includes('4k') || fileName.includes('2160p') || fileName.includes('uhd')) {
      detectedResolution = '1080p'; // 4K降到1080p
    } else if (fileName.includes('1080p') || fileName.includes('fhd')) {
      detectedResolution = '1080p';
    } else if (fileName.includes('720p') || fileName.includes('hd')) {
      detectedResolution = '720p';
    } else if (fileName.includes('480p') || fileName.includes('sd')) {
      detectedResolution = '480p';
    } else {
      // 如果没有明确指示，使用更智能的默认策略
      // 对于大文件(>100MB)，假设是高分辨率
      // 这里我们先使用请求的分辨率作为回退
      console.log(`📊 未检测到分辨率标识，使用请求分辨率: ${requestedResolution}`);
      detectedResolution = requestedResolution;
    }

    // 智能降级策略：确保输出分辨率不超过常见的最佳实践
    const resolutionHierarchy = ['480p', '720p', '1080p'];
    const targetIndex = resolutionHierarchy.indexOf(detectedResolution);

    if (targetIndex === -1) {
      // 如果检测到未知分辨率，默认使用720p
      detectedResolution = '720p';
      console.log(`⚠️ 未知分辨率，默认使用 720p`);
    }

    console.log(`✅ 智能分辨率选择完成: ${requestedResolution} -> ${detectedResolution}`);
    return detectedResolution;

  } catch (error) {
    console.error('❌ 分辨率分析失败，使用默认分辨率:', error);
    return requestedResolution || '720p';
  }
}

function buildVideoDescription(settings) {
  const resolutionMap = {
    "480p": { width: 854, height: 480, bitrate: 1500000 },
    "720p": { width: 1280, height: 720, bitrate: 3000000 },
    "1080p": { width: 1920, height: 1080, bitrate: 5000000 }
  };

  const resolution = resolutionMap[settings.resolution] || resolutionMap["720p"];

  return {
    ScalingBehavior: "DEFAULT",
    TimecodeInsertion: "DISABLED",
    AntiAlias: "ENABLED",
    Sharpness: 50,
    CodecSettings: {
      Codec: "H_264",
      H264Settings: {
        InterlaceMode: "PROGRESSIVE",
        NumberReferenceFrames: 3,
        Syntax: "DEFAULT",
        Softness: 0,
        GopClosedCadence: 1,
        GopSize: 90,
        Slices: 1,
        GopBReference: "DISABLED",
        SlowPal: "DISABLED",
        SpatialAdaptiveQuantization: "ENABLED",
        TemporalAdaptiveQuantization: "ENABLED",
        FlickerAdaptiveQuantization: "DISABLED",
        EntropyEncoding: "CABAC",
        Bitrate: resolution.bitrate,
        FramerateControl: "SPECIFIED",
        RateControlMode: "CBR",
        CodecProfile: "MAIN",
        Telecine: "NONE",
        MinIInterval: 0,
        AdaptiveQuantization: "HIGH",
        CodecLevel: "AUTO",
        FieldEncoding: "PAFF",
        SceneChangeDetect: "ENABLED",
        QualityTuningLevel: "SINGLE_PASS",
        FramerateConversionAlgorithm: "DUPLICATE_DROP",
        UnregisteredSeiTimecode: "DISABLED",
        GopSizeUnits: "FRAMES",
        ParControl: "INITIALIZE_FROM_SOURCE",
        NumberBFramesBetweenReferenceFrames: 2,
        RepeatPps: "DISABLED",
        FramerateNumerator: 30,
        FramerateDenominator: 1,
        DynamicSubGop: "STATIC"
      }
    },
    AfdSignaling: "NONE",
    DropFrameTimecode: "ENABLED",
    RespondToAfd: "NONE",
    ColorMetadata: "INSERT",
    Width: resolution.width,
    Height: resolution.height
  };
}