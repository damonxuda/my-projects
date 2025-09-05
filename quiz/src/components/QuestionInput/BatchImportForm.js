// BatchImportForm.js - 批量导入表单组件（增强LaTeX支持）
import React, { useState } from "react";
import { Loader, AlertCircle, CheckCircle } from "lucide-react";
import { MarkdownParser } from "../../services/MarkdownParser";

// 常量定义
const MATH_CATEGORIES = [
  "计算",
  "计数",
  "几何",
  "数论",
  "应用题",
  "行程",
  "组合",
  "综合",
];

const BatchImportForm = ({
  batchForm,
  setBatchForm,
  imageMap,
  onSubmit,
  onCancel,
}) => {
  // 新增：LaTeX处理状态
  const [latexProcessing, setLatexProcessing] = useState(false);
  const [latexStatus, setLatexStatus] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !batchForm.teacher ||
      !batchForm.semester ||
      !batchForm.course_name ||
      !batchForm.math_category ||
      !batchForm.markdownText
    ) {
      alert("请填写所有必填项：老师、学期、课程名、数学分类和题目内容");
      return;
    }

    // 新增：LaTeX预处理
    try {
      setLatexProcessing(true);
      setLatexStatus("正在检查数学公式...");

      const parser = new MarkdownParser();
      const hasLatex = parser.hasLatexContent(batchForm.markdownText);

      if (hasLatex) {
        setLatexStatus("检测到LaTeX公式，正在预加载渲染库...");
        await parser.loadKaTeX();
        setLatexStatus("数学渲染库已准备就绪");

        // 给用户一个简短的反馈时间
        setTimeout(() => setLatexStatus(""), 2000);
      }

      // 调用原有的提交逻辑
      onSubmit(e, imageMap);
    } catch (error) {
      console.error("LaTeX预处理失败:", error);
      setLatexStatus("LaTeX预处理失败，但不影响导入");
      setTimeout(() => setLatexStatus(""), 3000);
      // 即使LaTeX失败，也继续执行原有导入逻辑
      onSubmit(e, imageMap);
    } finally {
      setLatexProcessing(false);
    }
  };

  // 渲染LaTeX状态指示器
  const renderLatexStatus = () => {
    if (!latexProcessing && !latexStatus) return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center">
          {latexProcessing ? (
            <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
          ) : latexStatus.includes("失败") ? (
            <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
          ) : (
            <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
          )}
          <span
            className={`text-sm ${
              latexStatus.includes("失败") ? "text-orange-700" : "text-blue-700"
            }`}
          >
            {latexStatus}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderLatexStatus()}

      <form onSubmit={handleSubmit}>
        {/* 试卷信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              老师 *
            </label>
            <input
              type="text"
              value={batchForm.teacher}
              onChange={(e) =>
                setBatchForm({ ...batchForm, teacher: e.target.value })
              }
              placeholder="请输入老师姓名"
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学期 *
            </label>
            <input
              type="text"
              value={batchForm.semester}
              onChange={(e) =>
                setBatchForm({ ...batchForm, semester: e.target.value })
              }
              placeholder="请输入学期"
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              课程名 *
            </label>
            <input
              type="text"
              value={batchForm.course_name}
              onChange={(e) =>
                setBatchForm({ ...batchForm, course_name: e.target.value })
              }
              placeholder="请输入课程名"
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              数学分类 *
            </label>
            <select
              value={batchForm.math_category}
              onChange={(e) =>
                setBatchForm({
                  ...batchForm,
                  math_category: e.target.value,
                })
              }
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">请选择分类</option>
              {MATH_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 题目内容 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            题目内容（支持Markdown + LaTeX数学公式）*
          </label>
          <textarea
            value={batchForm.markdownText}
            onChange={(e) =>
              setBatchForm({ ...batchForm, markdownText: e.target.value })
            }
            placeholder="请粘贴标准MD格式题目（现在支持LaTeX数学公式）：示例格式请看下方说明"
            className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
            rows={18}
            required
          />
          <div className="text-xs text-gray-500 mt-2 space-y-1">
            <p>
              <strong>题号格式：</strong>[EX1] [HW1] [EX1-1]
              等，EX表示例题，HW表示习题
            </p>
            <p>
              <strong>图片标签：</strong>使用 [IMG:文件名] 格式，如 [IMG:01.png]
            </p>
            <p>
              <strong>表格标签：</strong>使用 [TABLE] 格式
            </p>
            <p className="text-blue-600">
              <strong>LaTeX公式：</strong>行内公式用 $...$ ，块级公式用 $$...$$
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={latexProcessing}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:bg-green-400 flex items-center"
          >
            {latexProcessing ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                处理中...
              </>
            ) : (
              "批量导入试卷"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
          >
            取消
          </button>
        </div>
      </form>

      {/* LaTeX使用提示 */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-800 mb-2">LaTeX数学公式支持</h4>
        <div className="text-sm text-blue-700">
          <p>
            <strong>示例：</strong>
          </p>
          <div className="bg-white p-2 rounded mt-1 font-mono text-xs">
            [EX1]
            <br />
            求圆的面积，半径为 5 厘米
            <br />
            答案：面积 = π × 5² = 25π 平方厘米
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchImportForm;
