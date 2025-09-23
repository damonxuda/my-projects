// 全局缩略图生成队列管理器
class ThumbnailQueue {
  constructor() {
    this.queue = [];
    this.running = new Set();
    this.maxConcurrent = 3; // 最大并发数
  }

  // 添加任务到队列
  async add(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ taskFn, resolve, reject });
      this.process();
    });
  }

  // 处理队列
  async process() {
    if (this.running.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { taskFn, resolve, reject } = this.queue.shift();
    const taskId = Date.now() + Math.random();
    this.running.add(taskId);

    try {
      const result = await taskFn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running.delete(taskId);
      // 继续处理队列中的下一个任务
      setTimeout(() => this.process(), 100);
    }
  }

  // 获取队列状态
  getStatus() {
    return {
      queueLength: this.queue.length,
      runningCount: this.running.size,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// 创建全局实例
const thumbnailQueue = new ThumbnailQueue();

export default thumbnailQueue;