// MarkdownParser.js - Markdown内容解析服务类
export class MarkdownParser {
  constructor() {
    // 构造函数暂时为空，后续可添加配置
  }

  // 处理表格标签
  processTableTags(content) {
    const tableTagRegex = /\[TABLE\]\s*\n((?:\|.*\|\s*\n)+)/g;
    return content.replace(tableTagRegex, (match, tableContent) => {
      try {
        const lines = tableContent.trim().split("\n");
        const htmlTable = this.markdownTableToHtml(lines);
        return htmlTable;
      } catch (error) {
        console.warn("表格解析失败，保持原格式:", error);
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
        console.warn("图片处理失败:", error);
        return `\n<p style="color: red; font-style: italic;">❌ 图片加载失败: ${imageName}</p>\n`;
      }
    });
  }

  // 将Markdown表格转换为HTML表格
  markdownTableToHtml(lines) {
    if (lines.length < 2) {
      throw new Error("表格格式不正确");
    }

    // 解析表头
    const headerLine = lines[0].trim();
    const separatorLine = lines[1].trim();

    // 检查分隔符行
    if (!separatorLine.includes("---")) {
      throw new Error("缺少表格分隔符");
    }

    // 提取表头
    const headers = headerLine
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell !== "");

    // 提取数据行
    const dataRows = lines
      .slice(2)
      .map((line) => {
        return line
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "");
      })
      .filter((row) => row.length > 0);

    // 生成HTML表格
    let html =
      '\n<table style="border-collapse: collapse; border: 1px solid #ddd; margin: 10px 0;">\n';

    // 表头
    html += '  <thead>\n    <tr style="background-color: #f5f5f5;">\n';
    headers.forEach((header) => {
      html += `      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${header}</th>\n`;
    });
    html += "    </tr>\n  </thead>\n";

    // 表体
    html += "  <tbody>\n";
    dataRows.forEach((row) => {
      html += "    <tr>\n";
      row.forEach((cell) => {
        html += `      <td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>\n`;
      });
      html += "    </tr>\n";
    });
    html += "  </tbody>\n</table>\n";

    return html;
  }

  // 解析单个题目内容
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
      const questionText = content
        .substring(0, content.indexOf("答案："))
        .trim();
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
          answer += "\n\n解题过程：\n" + process;
        }
      }

      return {
        question_number: questionNumber,
        question_text: questionText,
        answer: answer,
        question_type: "例题", // 默认类型，实际不再使用显示
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
      const cleanText = markdownText.replace(/\r\n/g, "\n").trim();

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
          number: match[2], // 数字部分
        });
      }

      if (matches.length === 0) {
        throw new Error(
          "未找到符合格式的题目标记（如[EX1]、[HW1]、[EX1-1]等）"
        );
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
        questionContent = questionContent
          .replace(/^\[(EX|HW)\d+(?:-\d+)?\]\s*/, "")
          .trim();

        // 处理题目内容，支持表格和图片
        const parsedQuestion = this.parseQuestionContent(
          questionContent,
          currentMatch.number,
          imageMap
        );

        if (parsedQuestion) {
          // 设置题目类型
          parsedQuestion.question_type =
            currentMatch.type === "EX" ? "例题" : "习题";
          questions.push(parsedQuestion);
        }
      }

      if (questions.length === 0) {
        throw new Error("未能解析出有效的题目内容");
      }

      return {
        success: true,
        data: questions,
        questions: questions,
        failedQuestions: [],
      };
    } catch (error) {
      console.error("解析Markdown失败:", error);
      return {
        success: false,
        error: error.message || "解析失败，请检查格式是否正确",
      };
    }
  }
}
