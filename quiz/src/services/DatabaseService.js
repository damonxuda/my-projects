// DatabaseService.js - 数据库服务类
import { createClient } from '@supabase/supabase-js';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.connectionStatus = {
      mode: 'Supabase',
      status: '未连接'
    };
  }

  // 初始化Supabase连接
  async initializeSupabase() {
    try {
      // 从环境变量获取配置
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase配置缺失');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.connectionStatus = {
        mode: 'Supabase',
        status: '已连接'
      };
      
      console.log('Supabase连接成功');
      return { success: true };
    } catch (error) {
      console.error('Supabase连接失败:', error);
      this.connectionStatus = {
        mode: 'Supabase',
        status: '连接失败'
      };
      return { success: false, error: error.message };
    }
  }

  // 获取连接状态
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // 获取所有试卷
  async getPapers() {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { data, error } = await this.supabase
        .from('papers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('获取试卷失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取所有题目（包含试卷信息）
  async getQuestions() {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { data, error } = await this.supabase
        .from('questions')
        .select(`
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
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('获取题目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 获取学习记录
  async getAttempts(options = {}) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      let query = this.supabase
        .from('attempts')
        .select('*')
        .order('created_at', { ascending: false });

      // 如果指定了用户ID，只获取该用户的记录
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('获取学习记录失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 添加试卷
  async addPaper(paperData) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { data, error } = await this.supabase
        .from('papers')
        .insert([paperData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('添加试卷失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 添加题目
  async addQuestion(questionData) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { data, error } = await this.supabase
        .from('questions')
        .insert([questionData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('添加题目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 记录学习尝试
  async recordAttempt(attemptData) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      // 转换字段名以匹配数据库
      const dbData = {
        question_id: attemptData.questionId,
        user_id: attemptData.userId,
        mastery_score: attemptData.masteryScore,
        is_marked_wrong: attemptData.isMarkedWrong || false
      };

      const { data, error } = await this.supabase
        .from('attempts')
        .insert([dbData])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('记录学习尝试失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 更新题目
  async updateQuestion(id, updates) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { data, error } = await this.supabase
        .from('questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('更新题目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 删除题目
  async deleteQuestion(id) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { error } = await this.supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('删除题目失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 批量添加试卷和题目
  async addPaperWithQuestions(paperData, questionsData) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      // 1. 检查是否已存在相同的试卷
      const { data: existingPapers, error: searchError } = await this.supabase
        .from('papers')
        .select('*')
        .eq('title', paperData.title)
        .eq('teacher', paperData.teacher)
        .eq('semester', paperData.semester)
        .eq('course_name', paperData.course_name)
        .eq('math_category', paperData.math_category);

      if (searchError) {
        throw new Error('检查重复试卷失败: ' + searchError.message);
      }

      let paperId;
      let paperResult;

      if (existingPapers && existingPapers.length > 0) {
        // 使用现有试卷
        paperId = existingPapers[0].id;
        paperResult = { data: existingPapers[0] };
        console.log('使用现有试卷:', existingPapers[0].title);
      } else {
        // 创建新试卷
        paperResult = await this.addPaper(paperData);
        if (!paperResult.success) {
          throw new Error('添加试卷失败: ' + paperResult.error);
        }
        paperId = paperResult.data.id;
        console.log('创建新试卷:', paperData.title);
      }

      // 2. 添加题目，关联到试卷
      const questionsWithPaperId = questionsData.map(q => ({
        ...q,
        paper_id: paperId
      }));

      const { data, error } = await this.supabase
        .from('questions')
        .insert(questionsWithPaperId)
        .select();

      if (error) throw error;

      return { 
        success: true, 
        data: { 
          paper: paperResult.data, 
          questions: data 
        } 
      };
    } catch (error) {
      console.error('批量添加失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 解析Markdown格式的题目 - 支持表格
  parseMarkdownQuestions(markdownText) {
    try {
      // 清理文本，统一换行符
      const cleanText = markdownText.replace(/\r\n/g, '\n').trim();
      
      // 使用更精确的正则表达式分割题目
      // 匹配【例数字】或【习题数字】等格式
      const questionRegex = /【(例|习题|题目)(\d+)】/g;
      const matches = [];
      let match;
      
      // 找到所有题目标记的位置
      while ((match = questionRegex.exec(cleanText)) !== null) {
        matches.push({
          index: match.index,
          title: match[0],
          number: match[2]
        });
      }
      
      if (matches.length === 0) {
        throw new Error('未找到符合格式的题目标记（如【例1】）');
      }
      
      const questions = [];
      
      // 逐个提取题目内容
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        
        // 确定当前题目的内容范围
        const startIndex = currentMatch.index;
        const endIndex = nextMatch ? nextMatch.index : cleanText.length;
        
        let questionContent = cleanText.substring(startIndex, endIndex).trim();
        
        // 移除题目开头的标记（如【例1】）
        questionContent = questionContent.replace(/^【(例|习题|题目)\d+】\s*/, '').trim();
        
        // 处理题目内容，支持表格
        const parsedQuestion = this.parseQuestionContent(questionContent, currentMatch.number);
        
        if (parsedQuestion) {
          questions.push(parsedQuestion);
        }
      }
      
      if (questions.length === 0) {
        throw new Error('未能解析出有效的题目内容');
      }
      
      return { success: true, data: questions, questions: questions, failedQuestions: [] };
      
    } catch (error) {
      console.error('解析Markdown失败:', error);
      return { 
        success: false, 
        error: error.message || '解析失败，请检查格式是否正确' 
      };
    }
  }

  // 解析单个题目内容 - 支持表格处理
  parseQuestionContent(content, questionNumber) {
    try {
      // 处理表格标签
      content = this.processTableTags(content);
      
      // 分离答案部分
      const answerMatch = content.match(/答案：([\s\S]*?)(?=解题过程：|$)/);
      if (!answerMatch) {
        console.warn(`题目${questionNumber}未找到答案部分`);
        return null;
      }
      
      // 提取题目文本（答案之前的部分）
      const questionText = content.substring(0, content.indexOf('答案：')).trim();
      if (!questionText) {
        console.warn(`题目${questionNumber}题目内容为空`);
        return null;
      }
      
      // 提取答案
      let answer = answerMatch[1].trim();
      
      // 如果有解题过程，也包含在答案中
      const processMatch = content.match(/解题过程：([\s\S]*?)(?=---|\n【|$)/);
      if (processMatch) {
        const process = processMatch[1].trim();
        if (process) {
          answer += '\n\n解题过程：\n' + process;
        }
      }
      
      return {
        question_number: questionNumber,
        question_text: questionText,
        answer: answer,
        question_type: '例题' // 默认类型，实际不再使用显示
      };
      
    } catch (error) {
      console.error(`解析题目${questionNumber}失败:`, error);
      return null;
    }
  }

  // 处理表格标签，将Markdown表格转换为HTML
  processTableTags(content) {
    // 查找【表格】标签
    const tableTagRegex = /【表格】\s*\n((?:\|.*\|\s*\n)+)/g;
    
    return content.replace(tableTagRegex, (match, tableContent) => {
      try {
        // 解析Markdown表格
        const lines = tableContent.trim().split('\n');
        const htmlTable = this.markdownTableToHtml(lines);
        return htmlTable;
      } catch (error) {
        console.warn('表格解析失败，保持原格式:', error);
        return match; // 如果解析失败，保持原格式
      }
    });
  }

  // 将Markdown表格转换为HTML表格
  markdownTableToHtml(lines) {
    if (lines.length < 2) {
      throw new Error('表格格式不正确');
    }
    
    // 解析表头
    const headerLine = lines[0].trim();
    const separatorLine = lines[1].trim();
    
    // 检查分隔符行
    if (!separatorLine.includes('---')) {
      throw new Error('缺少表格分隔符');
    }
    
    // 提取表头
    const headers = headerLine.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    
    // 提取数据行
    const dataRows = lines.slice(2).map(line => {
      return line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
    }).filter(row => row.length > 0);
    
    // 生成HTML表格
    let html = '\n<table style="border-collapse: collapse; border: 1px solid #ddd; margin: 10px 0;">\n';
    
    // 表头
    html += '  <thead>\n    <tr style="background-color: #f5f5f5;">\n';
    headers.forEach(header => {
      html += `      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${header}</th>\n`;
    });
    html += '    </tr>\n  </thead>\n';
    
    // 表体
    html += '  <tbody>\n';
    dataRows.forEach(row => {
      html += '    <tr>\n';
      row.forEach(cell => {
        html += `      <td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>\n`;
      });
      html += '    </tr>\n';
    });
    html += '  </tbody>\n</table>\n';
    
    return html;
  }

  // 调试用：检查数据库当前状态
  async debugDatabaseState() {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      console.log('=== 数据库调试检查 ===');
      
      // 1. 检查papers表的字段
      const { data: papersSchema, error: schemaError } = await this.supabase
        .from('papers')
        .select('*')
        .limit(1);
      
      if (schemaError) {
        console.error('Papers表查询错误:', schemaError);
      } else {
        console.log('Papers表样本数据:', papersSchema);
        if (papersSchema.length > 0) {
          console.log('Papers表字段:', Object.keys(papersSchema[0]));
        }
      }

      // 2. 检查是否有重复的试卷
      const { data: allPapers, error: papersError } = await this.supabase
        .from('papers')
        .select('*');
      
      if (!papersError && allPapers) {
        console.log('试卷总数:', allPapers.length);
        
        // 检查重复标题
        const titleCounts = {};
        allPapers.forEach(paper => {
          titleCounts[paper.title] = (titleCounts[paper.title] || 0) + 1;
        });
        
        const duplicates = Object.entries(titleCounts).filter(([title, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn('发现重复试卷:', duplicates);
        } else {
          console.log('没有重复试卷');
        }
      }

      // 3. 检查questions表
      const { data: questionsCount, error: qError } = await this.supabase
        .from('questions')
        .select('id', { count: 'exact' });
      
      if (!qError) {
        console.log('题目总数:', questionsCount?.length || 0);
      }

      return { success: true };
    } catch (error) {
      console.error('调试检查失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建单例实例
const db = new DatabaseService();
export default db;