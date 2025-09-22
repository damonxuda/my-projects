import { MediaConvertClient, CreateJobCommand, GetJobCommand } from "@aws-sdk/client-mediaconvert";
import { s3Client, VIDEO_BUCKET } from "../shared/s3-config.mjs";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "ap-northeast-1"
});

export async function processVideo(event, user) {
  try {
    console.log("=== 开始视频处理 ===");

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (parseError) {
      return createErrorResponse(400, "Invalid JSON in request body");
    }

    const { inputKey, outputPrefix, settings = {} } = body;

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

    // 构建MediaConvert作业配置
    const jobSettings = buildJobSettings(inputKey, outputPrefix, processingSettings);

    // 创建MediaConvert作业
    const createJobParams = {
      Role: process.env.MEDIACONVERT_ROLE_ARN || "arn:aws:iam::730335478220:role/service-role/MediaConvert_Default_Role",
      Settings: jobSettings,
      Queue: process.env.MEDIACONVERT_QUEUE_ARN,
      UserMetadata: {
        userId: user.id,
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

function buildJobSettings(inputKey, outputPrefix, settings) {
  const inputS3Url = `s3://${VIDEO_BUCKET}/${inputKey}`;
  const outputS3Prefix = `s3://${VIDEO_BUCKET}/${outputPrefix || "processed"}/`;

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
      NameModifier: `_${settings.resolution}_${settings.quality}`,
      ContainerSettings: {
        Container: settings.format.toUpperCase(),
        Mp4Settings: {
          CslgAtom: "INCLUDE",
          FreeSpaceBox: "EXCLUDE",
          MoovPlacement: "PROGRESSIVE_DOWNLOAD"
        }
      },
      VideoDescription: buildVideoDescription(settings),
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

  jobSettings.OutputGroups.push(mainOutputGroup);

  // 如果启用移动端版本，添加移动端输出组
  if (settings.enableMobile) {
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
              Bitrate: 800000,
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
              Bitrate: 64000,
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