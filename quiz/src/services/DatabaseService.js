// 适配新表结构的数据库服务
import { createSupabaseClientFromEnv, SUPABASE_CONFIG } from '../../../shared/supabase';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.tables = SUPABASE_CONFIG.tables;
    this.initializeSupabase();
  }

  // 初始化Supabase客户端
  initializeSupabase() {
    try {
      this.supabase = createSupabaseClientFromEnv();
    } catch (error) {
      console.error('❌ DatabaseService: Failed to initialize Supabase client:', error);
      throw error;
    }
  }

  // ===============================
  // 试卷相关操作
  // ===============================
  
  async addPaper(paperData) {
    try {
      const { data, error } = await this.supabase
        .from('papers')
        .insert([{
          title: paperData.title,
          teacher: paperData.teacher,
          semester: paperData.semester,
          course_name: paperData.courseName,
          math_category: paperData.mathCategory
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding paper:', error);
      return { success: false, error: error.message };
    }
  }

  async getPapers() {
    try {
      const { data, error } = await this.supabase
        .from('papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting papers:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 题目相关操作
  // ===============================
  
  async addQuestion(questionData) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .insert([{
          paper_id: questionData.paperId,
          question_type: questionData.questionType,
          question_number: questionData.questionNumber,
          question_text: questionData.questionText,
          answer: questionData.answer
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error adding question:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestions(filters = {}) {
    try {
      let query = this.supabase
        .from('questions')
        .select(`
          *,
          papers (
            title,
            teacher,
            semester,
            course_name,
            math_category
          )
        `)
        .order('created_at', { ascending: false });

      // 应用过滤器
      if (filters.paperId) {
        query = query.eq('paper_id', filters.paperId);
      }

      if (filters.search) {
        query = query.or(`question_text.ilike.%${filters.search}%,answer.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting questions:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestionById(id) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .select(`
          *,
          papers (
            title,
            teacher,
            semester,
            course_name,
            math_category
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting question:', error);
      return { success: false, error: error.message };
    }
  }

  async updateQuestion(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating question:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteQuestion(id) {
    try {
      const { error } = await this.supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting question:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 批量导入题目（新功能）
  // ===============================

  async addPaperWithQuestions(paperData, questionsData) {
    try {
      // 先添加试卷
      const paperResult = await this.addPaper(paperData);
      if (!paperResult.success) throw new Error(paperResult.error);

      const paperId = paperResult.data.id;
      const successfulQuestions = [];
      const failedQuestions = [];

      // 批量添加题目
      for (const questionData of questionsData) {
        try {
          const questionResult = await this.addQuestion({
            ...questionData,
            paperId: paperId
          });
          
          if (questionResult.success) {
            successfulQuestions.push(questionResult.data);
          } else {
            failedQuestions.push({ question: questionData, error: questionResult.error });
          }
        } catch (error) {
          failedQuestions.push({ question: questionData, error: error.message });
        }
      }

      return { 
        success: true, 
        data: {
          paper: paperResult.data,
          questions: successfulQuestions,
          failed: failedQuestions
        }
      };
    } catch (error) {
      console.error('Error adding paper with questions:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 答题记录相关操作
  // ===============================

  async recordAttempt(attemptData) {
    try {
      const { data, error } = await this.supabase
        .from('attempts')
        .insert([{
          question_id: attemptData.questionId,
          user_id: attemptData.userId,
          mastery_score: attemptData.masteryScore,
          is_marked_wrong: attemptData.isMarkedWrong || false
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error recording attempt:', error);
      return { success: false, error: error.message };
    }
  }

  async getAttempts(filters = {}) {
    try {
      let query = this.supabase
        .from('attempts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.questionId) {
        query = query.eq('question_id', filters.questionId);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting attempts:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 查询筛选方法
  // ===============================

  async getQuestionsByTeacher(teacher) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .select(`
          *,
          papers!inner (
            title,
            teacher,
            semester,
            course_name,
            math_category
          )
        `)
        .eq('papers.teacher', teacher);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting questions by teacher:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestionsByCategory(category) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .select(`
          *,
          papers!inner (
            title,
            teacher,
            semester,
            course_name,
            math_category
          )
        `)
        .eq('papers.math_category', category);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting questions by category:', error);
      return { success: false, error: error.message };
    }
  }

  async getQuestionsBySemester(semester) {
    try {
      const { data, error } = await this.supabase
        .from('questions')
        .select(`
          *,
          papers!inner (
            title,
            teacher,
            semester,
            course_name,
            math_category
          )
        `)
        .eq('papers.semester', semester);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error getting questions by semester:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // 工具方法
  // ===============================

  async testConnection() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { error } = await this.supabase
        .from('papers')
        .select('count(*)')
        .limit(1);

      if (error) throw error;
      
      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  getConnectionStatus() {
    return {
      mode: 'production',
      status: this.supabase ? 'connected' : 'disconnected'
    };
  }

  // 清空数据（开发/测试用）
  async clearAll() {
    try {
      // 先清空attempts
      await this.supabase.from('attempts').delete().neq('id', 0);
      // 再清空questions（会级联删除attempts）
      await this.supabase.from('questions').delete().neq('id', 0);
      // 最后清空papers（会级联删除questions）
      await this.supabase.from('papers').delete().neq('id', 0);
      
      return { success: true };
    } catch (error) {
      console.error('Error clearing data:', error);
      return { success: false, error: error.message };
    }
  }

  // ===============================
  // Markdown解析工具
  // ===============================

  parseMarkdownQuestions(markdownText) {
    try {
      const questions = [];
      const sections = markdownText.split('---').filter(section => section.trim());

      for (const section of sections) {
        const lines = section.trim().split('\n');
        let questionNumber = '';
        let questionText = '';
        let answer = '';
        let currentSection = 'question';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // 检测题号【例1】【第1题】等
          const numberMatch = trimmedLine.match(/【(.+?)】/);
          if (numberMatch) {
            questionNumber = numberMatch[1];
            continue;
          }
          
          // 检测答案标识
          if (trimmedLine.startsWith('答案：') || trimmedLine.startsWith('答案:')) {
            currentSection = 'answer';
            const answerText = trimmedLine.replace(/^答案[：:]/, '').trim();
            if (answerText) {
              answer += answerText + '\n';
            }
            continue;
          }
          
          // 根据当前section添加内容
          if (currentSection === 'question' && trimmedLine) {
            questionText += trimmedLine + '\n';
          } else if (currentSection === 'answer' && trimmedLine) {
            answer += trimmedLine + '\n';
          }
        }

        // 清理文本
        questionText = questionText.trim();
        answer = answer.trim();
        
        // 确定题目类型
        let questionType = '习题';
        if (questionNumber.includes('例')) {
          questionType = '例题';
        }

        if (questionNumber && questionText && answer) {
          questions.push({
            questionNumber: questionNumber,
            questionType: questionType,
            questionText: questionText,
            answer: answer
          });
        }
      }

      return { success: true, data: questions };
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建实例并导出
const databaseService = new DatabaseService();
export default databaseService;