// DatabaseService.js - 重构后的数据库服务类（主入口）
import { createClient } from "@supabase/supabase-js";
import { ImageService } from "./ImageService";
import { MarkdownParser } from "./MarkdownParser";
import { StorageService } from "./StorageService";
import quizEdgeFunctionService from "./QuizEdgeFunctionService";

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.connectionStatus = {
      mode: "Edge Function",
      status: "未连接",
    };

    // 初始化服务实例（延迟初始化，等supabase连接后）
    this.imageService = null;
    this.markdownParser = new MarkdownParser();
    this.storageService = new StorageService();
    this.edgeFunctionService = quizEdgeFunctionService;
  }

  // 初始化Supabase连接（现在使用 Edge Function）
  async initializeSupabase() {
    try {
      // 从环境变量获取配置
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase配置缺失");
      }

      // 仍然创建 supabase 客户端，用于 Storage 和 ImageService
      this.supabase = createClient(supabaseUrl, supabaseKey);

      // 初始化需要supabase实例的服务
      this.imageService = new ImageService(this.supabase);

      // 初始化 Edge Function 服务
      this.edgeFunctionService.initialize(supabaseUrl, supabaseKey);

      this.connectionStatus = {
        mode: "Edge Function",
        status: "已连接",
      };

      console.log("Quiz Edge Function 服务已初始化");
      return { success: true };
    } catch (error) {
      console.error("初始化失败:", error);
      this.connectionStatus = {
        mode: "Edge Function",
        status: "连接失败",
      };
      return { success: false, error: error.message };
    }
  }

  // 获取连接状态
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // ==================== 数据库操作方法 ====================

  // 获取所有试卷（通过 Edge Function）
  async getPapers() {
    try {
      return await this.edgeFunctionService.getPapers();
    } catch (error) {
      console.error("获取试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 获取所有题目（包含试卷信息，通过 Edge Function）
  async getQuestions() {
    try {
      return await this.edgeFunctionService.getQuestions();
    } catch (error) {
      console.error("获取题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 获取学习记录（通过 Edge Function）
  async getAttempts(options = {}) {
    try {
      return await this.edgeFunctionService.getAttempts(options.userId);
    } catch (error) {
      console.error("获取学习记录失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 添加试卷（通过 Edge Function）
  async addPaper(paperData) {
    try {
      return await this.edgeFunctionService.addPaper(paperData);
    } catch (error) {
      console.error("添加试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 添加题目（通过 Edge Function）
  async addQuestion(questionData) {
    try {
      return await this.edgeFunctionService.addQuestion(questionData);
    } catch (error) {
      console.error("添加题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 记录学习尝试（通过 Edge Function）
  async recordAttempt(attemptData) {
    try {
      return await this.edgeFunctionService.recordAttempt(attemptData);
    } catch (error) {
      console.error("记录学习尝试失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 更新题目（通过 Edge Function）
  async updateQuestion(id, updates) {
    try {
      return await this.edgeFunctionService.updateQuestion(id, updates);
    } catch (error) {
      console.error("更新题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 查找是否存在相同标签的试卷（通过 Edge Function）
  async findExistingPaper(teacher, semester, courseName, mathCategory, excludeId = null) {
    try {
      const result = await this.edgeFunctionService.findExistingPaper(
        teacher, semester, courseName, mathCategory, excludeId
      );
      console.log(`查找已存在试卷 (${teacher}, ${semester}, ${courseName}, ${mathCategory}):`, result.data);
      return result;
    } catch (error) {
      console.error("查找试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 更新试卷（通过 Edge Function）
  async updatePaper(id, updates) {
    try {
      console.log('updatePaper 调用参数:', { id, updates });
      const result = await this.edgeFunctionService.updatePaper(id, updates);
      console.log('试卷更新成功，返回数据:', result.data);
      return result;
    } catch (error) {
      console.error("更新试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 删除题目（通过 Edge Function）
  async deleteQuestion(id) {
    try {
      return await this.edgeFunctionService.deleteQuestion(id);
    } catch (error) {
      console.error("删除题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 图片服务委托方法 ====================

  // 删除单个图片
  async deleteImage(storageName) {
    return this.imageService.deleteImage(storageName);
  }

  // 批量删除图片
  async deleteImages(storageNames) {
    return this.imageService.deleteImages(storageNames);
  }

  // 替换图片
  async replaceImage(oldStorageName, newImageFile) {
    return this.imageService.replaceImage(oldStorageName, newImageFile);
  }

  // 批量上传图片到Supabase Storage
  async uploadImagesFromZip(zipFile, paperUUID = null) {
    return this.imageService.uploadImagesFromZip(zipFile, paperUUID);
  }

  // 重命名临时图片文件
  async renameTemporaryImages(imageMap, paperUUID) {
    return this.imageService.renameTemporaryImages(imageMap, paperUUID);
  }

  // 检查是否为图片文件
  isImageFile(filename) {
    return this.imageService.isImageFile(filename);
  }

  // ==================== Markdown解析委托方法 ====================

  // 处理表格标签
  processTableTags(content) {
    return this.markdownParser.processTableTags(content);
  }

  // 处理图片标签
  processImageTags(content, imageMap = {}) {
    return this.markdownParser.processImageTags(content, imageMap);
  }

  // 解析单个题目内容
  parseQuestionContent(content, questionNumber, imageMap = {}) {
    return this.markdownParser.parseQuestionContent(
      content,
      questionNumber,
      imageMap
    );
  }

  // 解析Markdown格式的题目
  parseMarkdownQuestions(markdownText, imageMap = {}) {
    return this.markdownParser.parseMarkdownQuestions(markdownText, imageMap);
  }

  // ==================== 复合业务逻辑方法 ====================

  // 批量添加试卷和题目（通过 Edge Function）
  async addPaperWithQuestions(paperData, questionsData, imageMap = {}) {
    try {
      // 1. 如果有临时图片，先重命名为正式文件名（使用临时 paper ID）
      // 注意：这里我们需要先调用 Edge Function，获取 paper ID 后再重命名图片
      const result = await this.edgeFunctionService.addPaperWithQuestions(paperData, questionsData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // 2. 如果有临时图片，重命名为正式文件名
      if (Object.keys(imageMap).length > 0) {
        const paperId = result.data.paper.id;
        await this.renameTemporaryImages(imageMap, paperId);
      }

      return result;
    } catch (error) {
      console.error("批量添加失败:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 调试和维护方法 ====================

  // 调试用：检查数据库当前状态（通过 Edge Function）
  async debugDatabaseState() {
    try {
      console.log("=== 数据库调试检查（通过 Edge Function）===");

      // 1. 检查papers表
      const papersResult = await this.getPapers();
      if (papersResult.success) {
        console.log("试卷总数:", papersResult.data.length);
        if (papersResult.data.length > 0) {
          console.log("Papers表字段:", Object.keys(papersResult.data[0]));
        }

        // 检查重复标题
        const titleCounts = {};
        papersResult.data.forEach((paper) => {
          titleCounts[paper.title] = (titleCounts[paper.title] || 0) + 1;
        });

        const duplicates = Object.entries(titleCounts).filter(
          ([, count]) => count > 1
        );
        if (duplicates.length > 0) {
          console.warn("发现重复试卷:", duplicates);
        } else {
          console.log("没有重复试卷");
        }
      }

      // 2. 检查questions表
      const questionsResult = await this.getQuestions();
      if (questionsResult.success) {
        console.log("题目总数:", questionsResult.data.length);
      }

      return { success: true };
    } catch (error) {
      console.error("调试检查失败:", error);
      return { success: false, error: error.message };
    }
  }
}

// 创建单例实例
const db = new DatabaseService();
export default db;
