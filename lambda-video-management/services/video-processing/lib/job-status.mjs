import { MediaConvertClient, GetJobCommand, ListJobsCommand } from "@aws-sdk/client-mediaconvert";
import { createSuccessResponse, createErrorResponse } from "../shared/s3-config.mjs";

const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || "ap-northeast-1"
});

export async function checkJobStatus(event, user) {
  try {
    console.log("=== 检查作业状态 ===");

    const queryParams = event.queryStringParameters || {};
    const { jobId } = queryParams;

    if (!jobId) {
      return createErrorResponse(400, "Missing required parameter: jobId");
    }

    console.log("Checking job status for:", jobId);

    // 获取作业详情
    const getJobParams = {
      Id: jobId
    };

    const jobResponse = await mediaConvertClient.send(new GetJobCommand(getJobParams));
    const job = jobResponse.Job;

    console.log("Job status:", job.Status);
    console.log("Job progress:", job.JobPercentComplete || 0);

    // 构建响应数据
    const responseData = {
      jobId: job.Id,
      status: job.Status,
      progress: job.JobPercentComplete || 0,
      createdAt: job.CreatedAt,
      updatedAt: job.LastModified,
      userMetadata: job.UserMetadata || {}
    };

    // 添加状态相关的详细信息
    switch (job.Status) {
      case "SUBMITTED":
        responseData.message = "作业已提交，等待开始处理";
        responseData.estimatedTimeRemaining = "准备中";
        break;

      case "PROGRESSING":
        responseData.message = "作业正在处理中";
        const progress = job.JobPercentComplete || 0;
        if (progress > 0) {
          const estimatedTotal = 600; // 假设总共需要10分钟
          const remaining = Math.round((estimatedTotal * (100 - progress)) / 100);
          responseData.estimatedTimeRemaining = `约 ${Math.max(1, Math.round(remaining / 60))} 分钟`;
        } else {
          responseData.estimatedTimeRemaining = "计算中";
        }
        break;

      case "COMPLETE":
        responseData.message = "作业已完成";
        responseData.estimatedTimeRemaining = "已完成";

        // 如果作业完成，添加输出文件信息
        if (job.OutputGroupDetails) {
          responseData.outputs = job.OutputGroupDetails.map(group => ({
            outputGroupName: group.OutputGroupName,
            outputDetails: group.OutputDetails?.map(output => ({
              outputFilePaths: output.OutputFilePaths,
              durationInMs: output.DurationInMs,
              videoDetails: output.VideoDetails
            })) || []
          }));
        }
        break;

      case "ERROR":
        responseData.message = "作业处理失败";
        responseData.estimatedTimeRemaining = "失败";
        responseData.errorMessage = job.ErrorMessage || "未知错误";
        break;

      case "CANCELED":
        responseData.message = "作业已取消";
        responseData.estimatedTimeRemaining = "已取消";
        break;

      default:
        responseData.message = `作业状态: ${job.Status}`;
        responseData.estimatedTimeRemaining = "未知";
    }

    // 添加计费信息（如果可用）
    if (job.BillingTagsSource) {
      responseData.billing = {
        tagsSource: job.BillingTagsSource,
        queue: job.Queue
      };
    }

    // 添加时间统计
    if (job.Timing) {
      responseData.timing = {
        submitTime: job.Timing.SubmitTime,
        startTime: job.Timing.StartTime,
        finishTime: job.Timing.FinishTime
      };
    }

    return createSuccessResponse(responseData);

  } catch (error) {
    console.error("检查作业状态失败:", error);

    // 如果是作业不存在的错误
    if (error.name === "NotFoundException" || error.message?.includes("does not exist")) {
      return createErrorResponse(404, "Job not found", "指定的作业ID不存在或已被删除");
    }

    return createErrorResponse(500, "Failed to check job status", error.message);
  }
}

export async function listUserJobs(event, user) {
  try {
    console.log("=== 获取用户作业列表 ===");

    const queryParams = event.queryStringParameters || {};
    const {
      status = "ALL",
      maxResults = "20",
      order = "DESCENDING"
    } = queryParams;

    console.log("List jobs with status:", status);

    const listJobsParams = {
      MaxResults: parseInt(maxResults),
      Order: order,
      Queue: process.env.MEDIACONVERT_QUEUE_ARN
    };

    // 如果指定了状态过滤
    if (status !== "ALL") {
      listJobsParams.Status = status;
    }

    const response = await mediaConvertClient.send(new ListJobsCommand(listJobsParams));

    // 过滤出属于当前用户的作业
    const userJobs = response.Jobs?.filter(job =>
      job.UserMetadata?.userId === user.id
    ) || [];

    console.log("Found user jobs:", userJobs.length);

    const jobsList = userJobs.map(job => ({
      jobId: job.Id,
      status: job.Status,
      progress: job.JobPercentComplete || 0,
      createdAt: job.CreatedAt,
      updatedAt: job.LastModified,
      originalKey: job.UserMetadata?.originalKey,
      queue: job.Queue
    }));

    return createSuccessResponse({
      jobs: jobsList,
      totalCount: userJobs.length,
      filter: {
        status,
        maxResults: parseInt(maxResults),
        order
      }
    });

  } catch (error) {
    console.error("获取作业列表失败:", error);
    return createErrorResponse(500, "Failed to list jobs", error.message);
  }
}