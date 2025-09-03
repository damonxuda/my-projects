import React, { useState, useRef, useEffect } from "react";
import { Printer, Download, Settings } from "lucide-react";

const QuestionPrintController = ({
  questions = [],
  filterDescription = "",
  onClose,
}) => {
  const [printMode, setPrintMode] = useState("questions_only"); // 'questions_only' 或 'with_answers'
  const [fontSize, setFontSize] = useState("五号"); // '五号', '小四', '四号'
  const [selectedQuestions, setSelectedQuestions] = useState(
    new Set(questions.map((q) => q.id))
  ); // 默认全选
  const printRef = useRef();

  // 字体大小映射
  const fontSizeMap = {
    五号: "10.5pt",
    小四: "12pt",
    四号: "14pt",
  };

  // 获取选中的题目
  const getSelectedQuestions = () => {
    return questions.filter((q) => selectedQuestions.has(q.id));
  };

  // 全选
  const selectAll = () => {
    setSelectedQuestions(new Set(questions.map((q) => q.id)));
  };

  // 全不选
  const selectNone = () => {
    setSelectedQuestions(new Set());
  };

  // 反选
  const invertSelection = () => {
    const newSelection = new Set();
    questions.forEach((q) => {
      if (!selectedQuestions.has(q.id)) {
        newSelection.add(q.id);
      }
    });
    setSelectedQuestions(newSelection);
  };

  // 单个题目选择切换
  const toggleQuestion = (questionId) => {
    const newSelection = new Set(selectedQuestions);
    if (newSelection.has(questionId)) {
      newSelection.delete(questionId);
    } else {
      newSelection.add(questionId);
    }
    setSelectedQuestions(newSelection);
  };

  // 格式化题目编号
  const formatQuestionNumber = (question, index) => {
    const teacher = question.teacher || "老师";
    const paperTitle = question.paper_title || "练习题";
    const questionNumber = question.question_number || `题${index + 1}`;
    return `${index + 1}. 【${teacher}】【${paperTitle}】【${questionNumber}】`;
  };

  // 处理图片标签
  const processImageTags = (text) => {
    if (!text) return "";
    return text.replace(/【图片】([^【】]+)/g, (match, filename) => {
      const imageUrl = `${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/question-images/${filename}`;
      return `<img src="${imageUrl}" style="max-width: 100mm; height: auto; display: block; margin: 10px 0;" alt="${filename}" />`;
    });
  };

  // 处理表格标签
  const processTableTags = (text) => {
    if (!text) return "";
    return text.replace(
      /【表格】([\s\S]*?)(?=【|$)/g,
      (match, tableContent) => {
        const lines = tableContent
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        if (lines.length === 0) return "";

        let html =
          '<table style="border-collapse: collapse; margin: 10px 0; width: 100%;">';
        lines.forEach((line, index) => {
          const cells = line
            .split("|")
            .map((cell) => cell.trim())
            .filter((cell) => cell);
          if (cells.length > 0) {
            html += "<tr>";
            cells.forEach((cell) => {
              const isHeader = index === 0;
              const tag = isHeader ? "th" : "td";
              const style = isHeader
                ? "border: 1px solid #000; padding: 5px; background-color: #f5f5f5; font-weight: bold; text-align: center;"
                : "border: 1px solid #000; padding: 5px; text-align: center;";
              html += `<${tag} style="${style}">${cell}</${tag}>`;
            });
            html += "</tr>";
          }
        });
        html += "</table>";
        return html;
      }
    );
  };

  // 打印功能
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const printContent = printRef.current.innerHTML;

    // 根据打印模式动态调整样式
    const questionSpacing = printMode === "questions_only" ? "30px" : "40px";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>奥数练习题</title>
          <style>
            @page {
              size: A4;
              margin: 2cm 2.5cm;
            }
            /* 专门针对打印模态框的布局重置 */
            @media print {
              .fixed.inset-0.flex,
              .overflow-auto,
              .max-h-\\[60vh\\] {
                display: block !important;
                position: static !important;
                overflow: visible !important;
                max-height: none !important;
                height: auto !important;
              }
            }
            body {
              font-family: "宋体", SimSun, serif;
              font-size: ${fontSizeMap[fontSize]};
              line-height: 1.6;
              margin: 0;
              padding: 0;
              color: #000;
            }
            .page-header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .page-header h1 {
              font-size: 18pt;
              font-weight: bold;
              margin: 0 0 10px 0;
            }
            .page-info {
              font-size: 12pt;
              color: #666;
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            .question {
              margin-bottom: ${questionSpacing};
              padding-bottom: 15px;
              border-bottom: 1px dotted #ccc;
            }
            .question:last-child {
              border-bottom: none;
            }
            .question-block {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              display: table;
              width: 100%;
            }
            .question-title {
              font-weight: bold;
              margin-bottom: 12px;
              font-size: ${fontSizeMap[fontSize]};
            }
            .question-content {
              line-height: 1.8;
              margin-bottom: ${printMode === "with_answers" ? "15px" : "0"};
            }
            .answer-section {
              margin-top: 15px;
              padding: 10px;
              background-color: #f9f9f9;
              border-left: 3px solid #007cff;
            }
            .answer-label {
              font-weight: bold;
              color: #007cff;
              margin-bottom: 5px;
            }
            .page-footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10pt;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
            }
            table {
              font-size: ${fontSizeMap[fontSize]};
              margin: 10px 0;
            }
            img {
              max-width: 100mm !important;
              height: auto !important;
              margin: 10px 0 !important;
            }
            @media print {
              .no-print { display: none !important; }
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const currentDate = new Date()
    .toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "/");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 简化的控制面板 */}
        <div className="p-4 border-b bg-gray-50 no-print">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">打印设置</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">打印模式</label>
              <select
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value)}
                className="w-full border rounded px-2 py-1"
              >
                <option value="questions_only">仅题目</option>
                <option value="with_answers">题目+答案</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">字体大小</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full border rounded px-2 py-1"
              >
                <option value="五号">五号 (10.5pt)</option>
                <option value="小四">小四 (12pt)</option>
                <option value="四号">四号 (14pt)</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                <Printer size={16} />
                打印
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-3">
            共 {questions.length} 道题目 | 已选中 {selectedQuestions.size} 道 |
            打印模式: {printMode === "questions_only" ? "仅题目" : "题目+答案"}
          </div>

          {/* 题目选择操作按钮 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                选择题目：
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  全选
                </button>
                <button
                  onClick={selectNone}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  全不选
                </button>
                <button
                  onClick={invertSelection}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  反选
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 预览区域 */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          {/* 题目列表（带复选框） */}
          <div className="mb-4 max-h-48 overflow-y-auto border rounded-lg">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedQuestions.has(question.id)}
                  onChange={() => toggleQuestion(question.id)}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {formatQuestionNumber(question, index)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {question.question_text
                      ?.replace(/<[^>]*>/g, "")
                      .substring(0, 100)}
                    ...
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 打印预览 */}
          <div ref={printRef}>
            {/* 页头 */}
            <div className="page-header">
              <h1>奥数练习题</h1>
              <div className="page-info">
                <span>题目总数：{selectedQuestions.size}道</span>
                <span>打印时间：{currentDate}</span>
              </div>
            </div>

            {/* 题目内容 - 只显示选中的题目 */}
            {getSelectedQuestions().map((question, index) => (
              <div key={question.id} className="question">
                <div className="question-block">
                  <div className="question-title">
                    {formatQuestionNumber(
                      question,
                      questions.findIndex((q) => q.id === question.id)
                    )}
                  </div>

                  <div
                    className="question-content"
                    dangerouslySetInnerHTML={{
                      __html: processTableTags(
                        processImageTags(question.question_text || "")
                      ),
                    }}
                  />
                </div>

                {printMode === "with_answers" && question.answer && (
                  <div className="answer-section">
                    <div className="answer-label">答案：</div>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: processTableTags(
                          processImageTags(question.answer)
                        ),
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* 页脚 */}
            <div className="page-footer">
              <span>筛选条件：{filterDescription || "全部题目"}</span>
              <span>打印日期：{currentDate.replace(/\//g, "")}</span>
              <span>共{selectedQuestions.size}题</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionPrintController;
