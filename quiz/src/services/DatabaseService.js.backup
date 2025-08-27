// DatabaseService.js - 数据库服务类（支持zip图片上传）
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

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

  // 删除单个图片（新增）
  async deleteImage(storageName) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { error } = await this.supabase.storage
        .from('question-images')
        .remove([storageName]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('删除图片失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 批量删除图片（新增）
  async deleteImages(storageNames) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      const { error } = await this.supabase.storage
        .from('question-images')
        .remove(storageNames);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('批量删除图片失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 替换图片（新增）
  async replaceImage(oldStorageName, newImageFile) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      // 先删除旧图片
      await this.deleteImage(oldStorageName);

      // 上传新图片，使用相同的文件名
      const { data, error } = await this.supabase.storage
        .from('question-images')
        .upload(oldStorageName, newImageFile);

      if (error) throw error;

      // 获取新的公共URL
      const { data: urlData } = this.supabase.storage
        .from('question-images')
        .getPublicUrl(oldStorageName);

      return { 
        success: true, 
        url: urlData.publicUrl,
        storageName: oldStorageName
      };
    } catch (error) {
      console.error('替换图片失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 批量上传图片到Supabase Storage（保持原有）
  async uploadImagesFromZip(zipFile, paperUUID = null) {
    try {
      if (!this.supabase) {
        throw new Error('数据库未初始化');
      }

      console.log('开始处理zip文件...');
      
      // 读取zip文件
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipFile);
      
      const uploadResults = [];
      const errors = [];
      
      // 遍历zip文件中的所有文件
      for (const filename in zipData.files) {
        const file = zipData.files[filename];
        
        // 跳过文件夹和非图片文件
        if (file.dir || 
            !this.isImageFile(filename) || 
            filename.startsWith('__MACOSX') || 
            filename.startsWith('._') ||
            filename.includes('/.')) {
          console.log(`跳过文件: ${filename}`);
          continue;
        }
        
        try {
          console.log(`处理图片: ${filename}`);
          
          // 从zip中提取图片数据
          const imageBlob = await file.async('blob');
          
          // 生成存储文件名
          let storageFileName;
          if (paperUUID) {
            // 使用试卷UUID命名：试卷UUID_原文件名
            storageFileName = `${paperUUID}_${filename}`;
          } else {
            // 临时命名，等试卷创建后再重命名
            storageFileName = `temp_${Date.now()}_${filename}`;
          }
          
          // 上传到Supabase Storage
          const { data, error } = await this.supabase.storage
            .from('question-images')
            .upload(storageFileName, imageBlob);

          if (error) {
            throw error;
          }

          // 获取公共URL
          const { data: urlData } = this.supabase.storage
            .from('question-images')
            .getPublicUrl(storageFileName);

          uploadResults.push({
            originalName: filename,
            storageName: storageFileName,
            url: urlData.publicUrl
          });
          
          console.log(`✅ 成功上传: ${filename}`);
          
        } catch (error) {
          console.error(`❌ 上传失败 ${filename}:`, error);
          errors.push({ filename, error: error.message });
        }
      }
      
      return {
        success: true,
        uploadedCount: uploadResults.length,
        uploads: uploadResults,
        errors: errors
      };
      
    } catch (error) {
      console.error('处理zip文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 检查是否为图片文件（保持原有）
  isImageFile(filename) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  // 批量添加试卷和题目（保持原有）
  async addPaperWithQuestions(paperData, questionsData, imageMap = {}) {
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

      // 2. 如果有临时图片，重命名为正式文件名
      if (Object.keys(imageMap).length > 0) {
        await this.renameTemporaryImages(imageMap, paperId);
      }

      // 3. 添加题目，关联到试卷
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

  // 重命名临时图片文件（保持原有）
  async renameTemporaryImages(imageMap, paperUUID) {
    try {
      for (const [originalName, imageInfo] of Object.entries(imageMap)) {
        const oldName = imageInfo.storageName;
        const newName = `${paperUUID}_${originalName}`;
        
        if (oldName.startsWith('temp_')) {
          // 移动/重命名文件
          const { data, error } = await this.supabase.storage
            .from('question-images')
            .move(oldName, newName);
          
          if (error) {
            console.error(`重命名图片失败 ${oldName} -> ${newName}:`, error);
          } else {
            // 更新imageMap中的信息
            imageInfo.storageName = newName;
            const { data: urlData } = this.supabase.storage
              .from('question-images')
              .getPublicUrl(newName);
            imageInfo.url = urlData.publicUrl;
            console.log(`✅ 重命名成功: ${oldName} -> ${newName}`);
          }
        }
      }
    } catch (error) {
      console.error('重命名临时图片失败:', error);
    }
  }

  // 处理表格标签
  processTableTags(content) {
    const tableTagRegex = /\[TABLE\]\s*\n((?:\|.*\|\s*\n)+)/g;
    return content.replace(tableTagRegex, (match, tableContent) => {
      try {
        const lines = tableContent.trim().split('\n');
        const htmlTable = this.markdownTableToHtml(lines);
        return htmlTable;
      } catch (error) {
        console.warn('表格解析失败，保持原格式:', error);
        return match;
      }
    });
  }

  // 处理图片标签
  processImageTags(content, imageMap = {}) {
    const imageTagRegex = /\[IMG:(.*?)\]/g;
    return content.replace(imageTagRegex, (match, imageName) => {
      try {
        const imageInfo = imageMap[imageName.trim()];
        
        if (imageInfo) {
          return `\n<img src="${imageInfo.url}" alt="${imageName}" style="max-width: 300px; height: auto; margin: 15px 0; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />\n`;
        } else {
          console.warn(`未找到图片: ${imageName}`);
          return `\n<p style="color: red; font-style: italic; padding: 10px; background: #fee; border: 1px solid #fcc; border-radius: 4px;">⚠️ 图片未找到: ${imageName}</p>\n`;
        }
      } catch (error) {
        console.warn('图片处理失败:', error);
        return `\n<p style="color: red; font-style: italic;">❌ 图片加载失败: ${imageName}</p>\n`;
      }
    });
  }

  // 将Markdown表格转换为HTML表格（保持原有）
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

  // 解析单个题目内容（保持原有）
  parseQuestionContent(content, questionNumber, imageMap = {}) {
    try {
      // 先处理图片标签
      content = this.processImageTags(content, imageMap);
      
      // 再处理表格标签
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

  // 解析Markdown格式的题目（修改版，支持新的英文标识符）
  parseMarkdownQuestions(markdownText, imageMap = {}) {
    try {
      // 清理文本，统一换行符
      const cleanText = markdownText.replace(/\r\n/g, '\n').trim();
      
      // 新的正则表达式：匹配 [EX数字] 或 [HW数字] 或 [EX数字-数字] 格式
      const questionRegex = /\[(EX|HW)(\d+(?:-\d+)?)\]/g;
      const matches = [];
      let match;
      
      // 找到所有题目标记的位置
      while ((match = questionRegex.exec(cleanText)) !== null) {
        matches.push({
          index: match.index,
          title: match[0],
          type: match[1], // EX 或 HW
          number: match[2] // 数字部分
        });
      }
      
      if (matches.length === 0) {
        throw new Error('未找到符合格式的题目标记（如[EX1]、[HW1]、[EX1-1]等）');
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
        
        // 移除题目开头的标记（如[EX1]、[HW2]等）
        questionContent = questionContent.replace(/^\[(EX|HW)\d+(?:-\d+)?\]\s*/, '').trim();
        
        // 处理题目内容，支持表格和图片
        const parsedQuestion = this.parseQuestionContent(questionContent, currentMatch.number, imageMap);
        
        if (parsedQuestion) {
          // 设置题目类型
          parsedQuestion.question_type = currentMatch.type === 'EX' ? '例题' : '习题';
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

  // 调试用：检查数据库当前状态（保持原有）
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