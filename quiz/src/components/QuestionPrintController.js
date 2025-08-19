import React, { useState, useRef, useEffect } from 'react';
import { Printer, Download, Settings } from 'lucide-react';

const QuestionPrintController = ({ 
  questions = [], 
  filterDescription = '', 
  onClose 
}) => {
  const [printMode, setPrintMode] = useState('questions_only'); // 'questions_only' 或 'with_answers'
  const [fontSize, setFontSize] = useState('五号'); // '五号', '小四', '四号'
  const [questionsPerPage, setQuestionsPerPage] = useState('auto'); // 'auto', '2', '3', '4'
  const printRef = useRef();

  // 字体大小映射
  const fontSizeMap = {
    '五号': '10.5pt',
    '小四': '12pt', 
    '四号': '14pt'
  };

  // 格式化题目编号
  const formatQuestionNumber = (question, index) => {
    const teacher = question.teacher || '老师';
    const paperTitle = question.paper_title || '练习题';
    const questionNumber = question.question_number || `题${index + 1}`;
    return `${index + 1}. 【${teacher}】【${paperTitle}】【${questionNumber}】`;
  };

  // 处理图片标签
  const processImageTags = (text) => {
    if (!text) return '';
    return text.replace(/【图片】([^【】]+)/g, (match, filename) => {
      const imageUrl = `${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/question-images/${filename}`;
      return `<img src="${imageUrl}" style="max-width: 100mm; height: auto; display: block; margin: 10px 0;" alt="${filename}" />`;
    });
  };

  // 处理表格标签
  const processTableTags = (text) => {
    if (!text) return '';
    return text.replace(/【表格】([\s\S]*?)(?=【|$)/g, (match, tableContent) => {
      const lines = tableContent.trim().split('\n').filter(line => line.trim());
      if (lines.length === 0) return '';
      
      let html = '<table style="border-collapse: collapse; margin: 10px 0; width: 100%;">';
      lines.forEach((line, index) => {
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length > 0) {
          html += '<tr>';
          cells.forEach(cell => {
            const isHeader = index === 0;
            const tag = isHeader ? 'th' : 'td';
            const style = isHeader 
              ? 'border: 1px solid #000; padding: 5px; background-color: #f5f5f5; font-weight: bold; text-align: center;'
              : 'border: 1px solid #000; padding: 5px; text-align: center;';
            html += `<${tag} style="${style}">${cell}</${tag}>`;
          });
          html += '</tr>';
        }
      });
      html += '</table>';
      return html;
    });
  };

  // 智能分页计算
  const calculateLayout = () => {
    const layouts = [];
    let currentPage = [];
    let currentPageHeight = 0;
    const maxPageHeight = 800; // A4纸面高度估算
    const questionSpacing = questionsPerPage === 'auto' ? 250 : 200; // 题目间距
    
    questions.forEach((question, index) => {
      const questionText = question.question_text || '';
      const estimatedHeight = Math.max(
        100, // 最小高度
        questionText.length * 0.3 + 80 // 基于文字长度估算
      );
      
      // 检查是否需要新页面
      if (currentPageHeight + estimatedHeight > maxPageHeight && currentPage.length > 0) {
        layouts.push([...currentPage]);
        currentPage = [];
        currentPageHeight = 0;
      }
      
      currentPage.push(question);
      currentPageHeight += estimatedHeight + questionSpacing;
    });
    
    // 添加最后一页
    if (currentPage.length > 0) {
      layouts.push(currentPage);
    }
    
    return layouts;
  };

  const layouts = calculateLayout();

  // 打印功能
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = printRef.current.innerHTML;
    
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
            body {
              font-family: "宋体", SimSun, serif;
              font-size: ${fontSizeMap[fontSize]};
              line-height: 1.5;
              margin: 0;
              padding: 0;
              color: #000;
            }
            .page {
              page-break-after: always;
              min-height: 26cm;
              position: relative;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .page-header {
              text-align: center;
              margin-bottom: 20px;
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
              margin-bottom: ${questionsPerPage === 'auto' ? '60px' : '40px'};
              min-height: ${questionsPerPage === 'auto' ? '200px' : '150px'};
            }
            .question-title {
              font-weight: bold;
              margin-bottom: 15px;
              font-size: ${fontSizeMap[fontSize]};
            }
            .question-content {
              line-height: 1.8;
              margin-bottom: 15px;
            }
            .answer-section {
              margin-top: 20px;
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
              position: absolute;
              bottom: 1cm;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10pt;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 5px;
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

  // 下载PDF功能
  const handleDownloadPDF = () => {
    const printContent = printRef.current.innerHTML;
    
    // 创建新窗口用于PDF打印
    const printWindow = window.open('', '_blank');
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
            body {
              font-family: "宋体", SimSun, serif;
              font-size: ${fontSizeMap[fontSize]};
              line-height: 1.5;
              margin: 0;
              padding: 0;
              color: #000;
            }
            .page {
              page-break-after: always;
              min-height: 26cm;
              position: relative;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .page-header {
              text-align: center;
              margin-bottom: 20px;
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
              margin-bottom: ${questionsPerPage === 'auto' ? '60px' : '40px'};
              min-height: ${questionsPerPage === 'auto' ? '200px' : '150px'};
            }
            .question-title {
              font-weight: bold;
              margin-bottom: 15px;
              font-size: ${fontSizeMap[fontSize]};
            }
            .question-content {
              line-height: 1.8;
              margin-bottom: 15px;
            }
            .answer-section {
              margin-top: 20px;
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
              position: absolute;
              bottom: 1cm;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10pt;
              color: #666;
              border-top: 1px solid #ccc;
              padding-top: 5px;
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
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // 提示用户在打印对话框中选择"另存为PDF"
    alert('请在打印对话框中选择"另存为PDF"来保存文件');
    printWindow.print();
  };

  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '/');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* 控制面板 */}
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
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
            
            <div>
              <label className="block text-sm font-medium mb-1">每页题数</label>
              <select
                value={questionsPerPage}
                onChange={(e) => setQuestionsPerPage(e.target.value)}
                className="w-full border rounded px-2 py-1"
              >
                <option value="auto">智能分页</option>
                <option value="2">2题/页</option>
                <option value="3">3题/页</option>
                <option value="4">4题/页</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                <Printer size={16} />
                打印
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center justify-center gap-1"
              >
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            共 {questions.length} 道题，预计 {layouts.length} 页
          </div>
        </div>

        {/* 预览区域 */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          <div ref={printRef}>
            {layouts.map((pageQuestions, pageIndex) => (
              <div key={pageIndex} className="page">
                {/* 页头 */}
                <div className="page-header">
                  <h1>奥数练习题</h1>
                  <div className="page-info">
                    <span>题目总数：{questions.length}道</span>
                    <span>打印时间：{currentDate}</span>
                  </div>
                </div>

                {/* 题目内容 */}
                {pageQuestions.map((question, qIndex) => {
                  const globalIndex = questions.findIndex(q => q.id === question.id);
                  return (
                    <div key={question.id} className="question">
                      <div className="question-title">
                        {formatQuestionNumber(question, globalIndex)}
                      </div>
                      
                      <div 
                        className="question-content"
                        dangerouslySetInnerHTML={{
                          __html: processTableTags(processImageTags(question.question_text || ''))
                        }}
                      />
                      
                      {printMode === 'with_answers' && question.answer && (
                        <div className="answer-section">
                          <div className="answer-label">答案：</div>
                          <div 
                            dangerouslySetInnerHTML={{
                              __html: processTableTags(processImageTags(question.answer))
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 页脚 */}
                <div className="page-footer">
                  <span>筛选条件：{filterDescription || '全部题目'}</span>
                  <span>打印日期：{currentDate.replace(/\//g, '')}</span>
                  <span>{pageIndex + 1}/{layouts.length}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionPrintController;