// DatabaseService.js - 重构后的数据库服务类（主入口）
import { createClient } from "@supabase/supabase-js";
import { ImageService } from "./ImageService";
import { MarkdownParser } from "./MarkdownParser";
import { StorageService } from "./StorageService";

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.connectionStatus = {
      mode: "Supabase",
      status: "未连接",
    };

    // 初始化服务实例（延迟初始化，等supabase连接后）
    this.imageService = null;
    this.markdownParser = new MarkdownParser();
    this.storageService = new StorageService();
  }

  // 初始化Supabase连接
  async initializeSupabase() {
    try {
      // 从环境变量获取配置
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase配置缺失");
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      // 初始化需要supabase实例的服务
      this.imageService = new ImageService(this.supabase);

      this.connectionStatus = {
        mode: "Supabase",
        status: "已连接",
      };

      console.log("Supabase连接成功");
      return { success: true };
    } catch (error) {
      console.error("Supabase连接失败:", error);
      this.connectionStatus = {
        mode: "Supabase",
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

  // 获取所有试卷
  async getPapers() {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { data, error } = await this.supabase
        .from("papers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error("获取试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 获取所有题目（包含试卷信息）
  async getQuestions() {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { data, error } = await this.supabase
        .from("questions")
        .select(
          `
          *,
          papers (
            id,
            title,
            teacher,
            semester,
            course_name,
            math_category,
            created_at
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error("获取题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 获取学习记录
  async getAttempts(options = {}) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      let query = this.supabase
        .from("attempts")
        .select("*")
        .order("created_at", { ascending: false });

      // 如果指定了用户ID，只获取该用户的记录
      if (options.userId) {
        query = query.eq("user_id", options.userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error("获取学习记录失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 添加试卷
  async addPaper(paperData) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { data, error } = await this.supabase
        .from("papers")
        .insert([paperData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("添加试卷失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 添加题目
  async addQuestion(questionData) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { data, error } = await this.supabase
        .from("questions")
        .insert([questionData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("添加题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 记录学习尝试
  async recordAttempt(attemptData) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      // 转换字段名以匹配数据库
      const dbData = {
        question_id: attemptData.questionId,
        user_id: attemptData.userId,
        mastery_score: attemptData.masteryScore,
        is_marked_wrong: attemptData.isMarkedWrong || false,
      };

      const { data, error } = await this.supabase
        .from("attempts")
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("记录学习尝试失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 更新题目
  async updateQuestion(id, updates) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { data, error } = await this.supabase
        .from("questions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error("更新题目失败:", error);
      return { success: false, error: error.message };
    }
  }

  // 删除题目
  async deleteQuestion(id) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      const { error } = await this.supabase
        .from("questions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return { success: true };
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

  // 批量添加试卷和题目
  async addPaperWithQuestions(paperData, questionsData, imageMap = {}) {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      // 1. 检查是否已存在相同的试卷
      const { data: existingPapers, error: searchError } = await this.supabase
        .from("papers")
        .select("*")
        .eq("title", paperData.title)
        .eq("teacher", paperData.teacher)
        .eq("semester", paperData.semester)
        .eq("course_name", paperData.course_name)
        .eq("math_category", paperData.math_category);

      if (searchError) {
        throw new Error("检查重复试卷失败: " + searchError.message);
      }

      let paperId;
      let paperResult;

      if (existingPapers && existingPapers.length > 0) {
        // 使用现有试卷
        paperId = existingPapers[0].id;
        paperResult = { data: existingPapers[0] };
        console.log("使用现有试卷:", existingPapers[0].title);
      } else {
        // 创建新试卷
        paperResult = await this.addPaper(paperData);
        if (!paperResult.success) {
          throw new Error("添加试卷失败: " + paperResult.error);
        }
        paperId = paperResult.data.id;
        console.log("创建新试卷:", paperData.title);
      }

      // 2. 如果有临时图片，重命名为正式文件名
      if (Object.keys(imageMap).length > 0) {
        await this.renameTemporaryImages(imageMap, paperId);
      }

      // 3. 添加题目，关联到试卷
      const questionsWithPaperId = questionsData.map((q) => ({
        ...q,
        paper_id: paperId,
      }));

      const { data, error } = await this.supabase
        .from("questions")
        .insert(questionsWithPaperId)
        .select();

      if (error) throw error;

      return {
        success: true,
        data: {
          paper: paperResult.data,
          questions: data,
        },
      };
    } catch (error) {
      console.error("批量添加失败:", error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 调试和维护方法 ====================

  // 调试用：检查数据库当前状态
  async debugDatabaseState() {
    try {
      if (!this.supabase) {
        throw new Error("数据库未初始化");
      }

      console.log("=== 数据库调试检查 ===");

      // 1. 检查papers表的字段
      const { data: papersSchema, error: schemaError } = await this.supabase
        .from("papers")
        .select("*")
        .limit(1);

      if (schemaError) {
        console.error("Papers表查询错误:", schemaError);
      } else {
        console.log("Papers表样本数据:", papersSchema);
        if (papersSchema.length > 0) {
          console.log("Papers表字段:", Object.keys(papersSchema[0]));
        }
      }

      // 2. 检查是否有重复的试卷
      const { data: allPapers, error: papersError } = await this.supabase
        .from("papers")
        .select("*");

      if (!papersError && allPapers) {
        console.log("试卷总数:", allPapers.length);

        // 检查重复标题
        const titleCounts = {};
        allPapers.forEach((paper) => {
          titleCounts[paper.title] = (titleCounts[paper.title] || 0) + 1;
        });

        const duplicates = Object.entries(titleCounts).filter(
          ([title, count]) => count > 1
        );
        if (duplicates.length > 0) {
          console.warn("发现重复试卷:", duplicates);
        } else {
          console.log("没有重复试卷");
        }
      }

      // 3. 检查questions表
      const { data: questionsCount, error: qError } = await this.supabase
        .from("questions")
        .select("id", { count: "exact" });

      if (!qError) {
        console.log("题目总数:", questionsCount?.length || 0);
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
