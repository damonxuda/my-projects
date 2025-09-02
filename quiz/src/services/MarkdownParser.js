// MarkdownParser.js - StrictMode兼容的LaTeX处理版本

// 全局CDN脚本加载器单例
class CDNScriptLoader {
  constructor() {
    this.loadedScripts = new Map(); // 记录已加载的脚本URL
    this.loadingPromises = new Map(); // 缓存正在加载的Promise
  }

  async loadScript(src, integrity = null, crossOrigin = "anonymous") {
    // 如果脚本已经加载完成，直接返回成功
    if (this.loadedScripts.has(src)) {
      return true;
    }

    // 如果脚本正在加载中，返回已存在的Promise（防止重复加载）
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src);
    }

    // 创建新的加载Promise
    const loadPromise = new Promise((resolve, reject) => {
      // 检查脚本是否已存在于DOM中
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        this.loadedScripts.set(src, true);
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      if (integrity) script.integrity = integrity;
      if (crossOrigin) script.crossOrigin = crossOrigin;
      script.async = true;

      script.onload = () => {
        this.loadedScripts.set(src, true);
        this.loadingPromises.delete(src);
        console.log(`✅ 脚本加载成功: ${src}`);
        resolve(true);
      };

      script.onerror = () => {
        this.loadingPromises.delete(src);
        console.error(`❌ 脚本加载失败: ${src}`);
        reject(new Error(`Failed to load script: ${src}`));
      };

      document.head.appendChild(script);
    });

    // 缓存Promise以防止重复请求
    this.loadingPromises.set(src, loadPromise);
    return loadPromise;
  }

  async loadCSS(href, integrity = null, crossOrigin = "anonymous") {
    // CSS加载逻辑类似
    if (this.loadedScripts.has(href)) {
      return true;
    }

    if (this.loadingPromises.has(href)) {
      return this.loadingPromises.get(href);
    }

    const loadPromise = new Promise((resolve, reject) => {
      // 检查CSS是否已存在
      const existingLink = document.querySelector(`link[href="${href}"]`);
      if (existingLink) {
        this.loadedScripts.set(href, true);
        resolve(true);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      if (integrity) link.integrity = integrity;
      if (crossOrigin) link.crossOrigin = crossOrigin;

      link.onload = () => {
        this.loadedScripts.set(href, true);
        this.loadingPromises.delete(href);
        console.log(`✅ CSS加载成功: ${href}`);
        resolve(true);
      };

      link.onerror = () => {
        this.loadingPromises.delete(href);
        console.error(`❌ CSS加载失败: ${href}`);
        reject(new Error(`Failed to load CSS: ${href}`));
      };

      document.head.appendChild(link);
    });

    this.loadingPromises.set(href, loadPromise);
    return loadPromise;
  }
}

// 全局单例实例
const scriptLoader = new CDNScriptLoader();

export class MarkdownParser {
  constructor() {
    // 移除实例级别的加载状态，改用全局单例管理
  }

  // 优化的KaTeX加载方法 - StrictMode兼容
  async loadKaTeX() {
    try {
      // 首先检查KaTeX是否已经全局可用
      if (window.katex && window.renderMathInElement) {
        console.log("✅ KaTeX已存在，跳过加载");
        return true;
      }

      console.log("🔄 开始加载KaTeX...");

      // 使用单例加载器按顺序加载资源
      await scriptLoader.loadCSS(
        "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css",
        "sha512-fHwaWebuwA7NSF5Qg/af4UeDx9XqUpYpOGgubo3yWu+b2IQR4UeQwbb42Ti7gVAjNtVoI/I9TEoYeu9omwcC6g=="
      );

      await scriptLoader.loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js",
        "sha512-LQNxIMR5rXv7o+b1l8+N1EZMfhG7iFZ9HhnbJkTp4zjNr5Wvst75AqUeFDxeRUa7l5vEDyUiAip//r+EFLLCyA=="
      );

      await scriptLoader.loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js",
        "sha512-iWiuBS5nt6r60fCz26Nd0Zqe0nbk1ZTIQbl3Kv7kYsX+yKMUFHzjaH2+AnM6vp2Xs+gNmaBAVWJjSmuPw76Efg=="
      );

      // 等待一小段时间确保脚本完全初始化
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 最终验证
      if (window.katex && window.renderMathInElement) {
        console.log("✅ KaTeX加载完成并验证成功");
        return true;
      } else {
        throw new Error("KaTeX加载后验证失败");
      }
    } catch (error) {
      console.error("❌ KaTeX加载失败:", error);
      throw error;
    }
  }

  // 检测内容是否包含LaTeX公式
  hasLatexContent(content) {
    if (!content) return false;

    const latexPatterns = [
      /\$\$[\s\S]*?\$\$/, // 块级公式 $$...$$
      /\$[^$\n]*\$/, // 行内公式 $...$
      /\\\[[\s\S]*?\\\]/, // 块级公式 \[...\]
      /\\\([\s\S]*?\\\)/, // 行内公式 \(...\)
    ];

    return latexPatterns.some((pattern) => pattern.test(content));
  }

  // 处理LaTeX标签和公式渲染
  async processLatexTags(content) {
    try {
      // 如果内容不包含LaTeX，直接返回
      if (!this.hasLatexContent(content)) {
        return content;
      }

      // 确保KaTeX库已加载（单例保证不会重复加载）
      await this.loadKaTeX();

      // 创建临时元素来渲染LaTeX
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;

      // 使用KaTeX自动渲染
      if (window.renderMathInElement) {
        window.renderMathInElement(tempDiv, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
          errorColor: "#cc0000",
          strict: false,
          output: "html",
          trust: true,
          macros: {
            "\\triangle": "\\bigtriangleup",
            "\\therefore": "\\mathord{\\therefore}\\,",
            "\\because": "\\mathord{\\because}\\,",
            "\\parallel": "\\parallel",
            "\\perp": "\\perp",
          },
        });
      }

      return tempDiv.innerHTML;
    } catch (error) {
      console.warn("LaTeX处理失败，保持原格式:", error);
      return content;
    }
  }

  // 处理表格标签（保持原有逻辑）
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

  // 处理图片标签（保持原有逻辑）
  processImageTags(content, imageMap = {}) {
    // 扩展的正则表达式，支持可选的尺寸参数
    const imageTagRegex = /\[IMG:(.*?)(?:\?size=(large|small))?\]/g;

    return content.replace(imageTagRegex, (match, imageName, sizeParam) => {
      try {
        const imageInfo = imageMap[imageName.trim()];

        if (imageInfo) {
          // 根据尺寸参数确定样式
          let maxWidth = "300px"; // 默认尺寸（题目中的图形）

          if (sizeParam === "large") {
            maxWidth = "95%"; // 大尺寸，适合答案图片，占满题目区域宽度
          } else if (sizeParam === "small") {
            maxWidth = "200px"; // 小尺寸，如果需要的话
          }

          return `\n<img src="${imageInfo.url}" alt="${imageName}" style="max-width: ${maxWidth} !important; width: auto !important; height: auto; margin: 15px 0; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />\n`;
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

  // 将Markdown表格转换为HTML表格（保持原有逻辑）
  markdownTableToHtml(lines) {
    if (lines.length < 2) {
      throw new Error("表格格式不正确");
    }

    const headerLine = lines[0].trim();
    const separatorLine = lines[1].trim();

    if (!separatorLine.includes("---")) {
      throw new Error("缺少表格分隔符");
    }

    const headers = headerLine
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell) => cell !== "");

    const dataRows = lines
      .slice(2)
      .map((line) => {
        return line
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell !== "");
      })
      .filter((row) => row.length > 0);

    let html =
      '\n<table style="border-collapse: collapse; border: 1px solid #ddd; margin: 10px 0;">\n';

    html += '  <thead>\n    <tr style="background-color: #f5f5f5;">\n';
    headers.forEach((header) => {
      html += `      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${header}</th>\n`;
    });
    html += "    </tr>\n  </thead>\n";

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

  // 解析单个题目内容（保持原有逻辑）
  async parseQuestionContent(content, questionNumber, imageMap = {}) {
    try {
      content = this.processImageTags(content, imageMap);
      content = this.processTableTags(content);

      const answerMatch = content.match(/答案：([\s\S]*?)(?=解题过程：|$)/);
      if (!answerMatch) {
        console.warn(`题目${questionNumber}未找到答案部分`);
        return null;
      }

      let questionText = content.substring(0, content.indexOf("答案：")).trim();
      let answer = answerMatch[1].trim();

      const processMatch = content.match(/解题过程：([\s\S]*?)(?=---|\n【|$)/);
      if (processMatch) {
        const process = processMatch[1].trim();
        if (process) {
          answer += "\n\n解题过程：\n" + process;
        }
      }

      questionText = await this.processLatexTags(questionText);
      answer = await this.processLatexTags(answer);

      const hasQuestionContent = this.hasValidContent(questionText);
      const hasAnswerContent = this.hasValidContent(answer);

      if (!hasQuestionContent) {
        console.warn(`题目${questionNumber}题目内容为空（无文字也无图片）`);
        return null;
      }

      if (!hasAnswerContent) {
        console.warn(`题目${questionNumber}答案内容为空（无文字也无图片）`);
        return null;
      }

      return {
        question_number: questionNumber,
        question_text: questionText,
        answer: answer,
        question_type: "例题",
      };
    } catch (error) {
      console.error(`解析题目${questionNumber}失败:`, error);
      return null;
    }
  }

  // 检查内容是否有效（保持原有逻辑）
  hasValidContent(content) {
    if (!content) return false;

    const textContent = content.replace(/<[^>]*>/g, "").trim();
    const hasImages = /<img[^>]*src=/i.test(content);
    const hasTables = /<table[^>]*>/i.test(content);
    const hasLatex =
      /<span[^>]*class[^>]*katex[^>]*>/i.test(content) ||
      this.hasLatexContent(content);

    return textContent.length > 0 || hasImages || hasTables || hasLatex;
  }

  // 解析Markdown格式的题目（保持原有逻辑）
  async parseMarkdownQuestions(markdownText, imageMap = {}) {
    try {
      const cleanText = markdownText.replace(/\r\n/g, "\n").trim();
      const questionRegex = /\[(EX|HW)(\d+(?:-\d+)?)\]/g;
      const matches = [];
      let match;

      while ((match = questionRegex.exec(cleanText)) !== null) {
        matches.push({
          index: match.index,
          title: match[0],
          type: match[1],
          number: match[2],
        });
      }

      if (matches.length === 0) {
        throw new Error(
          "未找到符合格式的题目标记（如[EX1]、[HW1]、[EX1-1]等）"
        );
      }

      const questions = [];

      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];

        const startIndex = currentMatch.index;
        const endIndex = nextMatch ? nextMatch.index : cleanText.length;

        let questionContent = cleanText.substring(startIndex, endIndex).trim();
        questionContent = questionContent
          .replace(/^\[(EX|HW)\d+(?:-\d+)?\]\s*/, "")
          .trim();

        const parsedQuestion = await this.parseQuestionContent(
          questionContent,
          currentMatch.number,
          imageMap
        );

        if (parsedQuestion) {
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

  // 静态方法：为已渲染的DOM元素处理LaTeX
  static async renderLatexInElement(element) {
    try {
      const parser = new MarkdownParser();
      await parser.loadKaTeX();

      if (window.renderMathInElement) {
        window.renderMathInElement(element, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
          errorColor: "#cc0000",
          strict: false,
        });
      }
    } catch (error) {
      console.warn("DOM元素LaTeX渲染失败:", error);
    }
  }
}
