// QuestionInput/index.js - 重构后的题目录入主组件（只负责批量导入）
import React, { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import ZipUploadComponent from "./ZipUploadComponent";
import BatchImportForm from "./BatchImportForm";
import ManualForm from "./ManualForm";
import { MarkdownParser } from "../../services/MarkdownParser";

const QuestionInput = ({
  questions,
  setQuestions,
  db,
  user,
  handleManualQuestionSubmit,
  papers, // 从 props 接收
  getTeachers, // 从 props 接收
  getSemesters, // 从 props 接收
}) => {
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  // 删除本地的 papers 状态，使用传入的 props

  // 批量导入状态
  const [batchForm, setBatchForm] = useState({
    teacher: "",
    semester: "",
    course_name: "",
    math_category: "",
    markdownText: "",
  });

  // 图片映射状态
  const [imageMap, setImageMap] = useState({});

  // 分类和题目类型
  const mathCategories = [
    "计算",
    "计数",
    "几何",
    "数论",
    "应用题",
    "行程",
    "组合",
    "综合",
  ];
  const questionTypes = ["例题", "习题"];

  // 自动生成试卷标题
  const generatePaperTitle = (
    teacher,
    semester,
    course_name,
    math_category
  ) => {
    const parts = [teacher, semester, course_name].filter(Boolean);
    if (parts.length === 0) {
      return `${math_category}练习题`;
    }
    return parts.join("");
  };

  // 删除本地的试卷加载逻辑，使用传入的 papers props
  // useEffect(() => {
  //   const loadPapers = async () => { ... }
  // }, [db, user]);

  // 试卷+题目批量添加
  const handleBatchImport = async (e, imageMap = {}) => {
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

    try {
      // 自动生成试卷标题
      const title = generatePaperTitle(
        batchForm.teacher,
        batchForm.semester,
        batchForm.course_name,
        batchForm.math_category
      );

      // 使用异步MarkdownParser
      const parser = new MarkdownParser();
      const parseResult = await parser.parseMarkdownQuestions(
        batchForm.markdownText,
        imageMap
      );

      if (!parseResult.success) throw new Error(parseResult.error);

      const questions = parseResult.data;
      if (questions.length === 0) {
        throw new Error("没有解析到有效的题目，请检查格式");
      }

      console.log("解析到的题目（含LaTeX）:", questions);

      // 添加试卷和题目，传入图片映射
      const result = await db.addPaperWithQuestions(
        {
          title: title,
          teacher: batchForm.teacher,
          semester: batchForm.semester,
          course_name: batchForm.course_name,
          math_category: batchForm.math_category,
        },
        questions,
        imageMap
      );

      if (!result.success) throw new Error(result.error);

      // 重新加载数据由父组件处理
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }

      setBatchForm({
        teacher: "",
        semester: "",
        course_name: "",
        math_category: "",
        markdownText: "",
      });
      setImageMap({});
      setShowBatchImport(false);

      // 获取导入的题目数量
      const importedQuestions = result.data.questions || [];
      const questionCount = importedQuestions.length;

      // 检测是否有LaTeX内容
      const hasLatexContent = questions.some(
        (q) =>
          parser.hasLatexContent(q.question_text) ||
          parser.hasLatexContent(q.answer)
      );

      const message = hasLatexContent
        ? `试卷"${title}"创建成功！成功导入 ${questionCount} 道题目（包含数学公式）！`
        : `试卷"${title}"创建成功！成功导入 ${questionCount} 道题目！`;

      alert(message);
    } catch (error) {
      console.error("批量导入失败:", error);
      alert("导入失败：" + error.message);
    }
  };

  // 图片上传完成回调
  const handleImagesUploaded = (uploadedImageMap) => {
    setImageMap(uploadedImageMap);
    console.log("图片映射已更新:", uploadedImageMap);
  };

  // 批量导入取消处理
  const handleBatchImportCancel = () => {
    setShowBatchImport(false);
    setBatchForm({
      teacher: "",
      semester: "",
      course_name: "",
      math_category: "",
      markdownText: "",
    });
  };

  // 单题输入取消处理
  const handleManualFormCancel = () => {
    setShowManualForm(false);
  };

  // 权限检查
  const canAddQuestions = () => {
    return user && user.emailAddresses && user.emailAddresses.length > 0;
  };

  return (
    <div>
      {/* 权限提示 */}
      {!canAddQuestions() && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>权限提示：</strong>请先登录后再添加或导入题目。
          </p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowBatchImport(!showBatchImport)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <Upload size={20} />
          批量导入试卷
        </button>
        <button
          onClick={() => setShowManualForm(!showManualForm)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          添加单题
        </button>
      </div>

      {/* 批量导入表单 */}
      {showBatchImport && canAddQuestions() && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">批量导入试卷和题目</h3>

          {/* Zip上传组件 */}
          <ZipUploadComponent
            onImagesUploaded={handleImagesUploaded}
            imageMap={imageMap}
            db={db}
          />

          {/* 批量导入表单 */}
          <BatchImportForm
            batchForm={batchForm}
            setBatchForm={setBatchForm}
            imageMap={imageMap}
            onSubmit={handleBatchImport}
            onCancel={handleBatchImportCancel}
          />
        </div>
      )}

      {/* 单题添加表单 */}
      {showManualForm && canAddQuestions() && (
        <ManualForm
          onSubmit={handleManualQuestionSubmit}
          onCancel={handleManualFormCancel}
          categories={mathCategories}
          questionTypes={questionTypes}
          papers={papers} // 现在可以传递了
          getTeachers={getTeachers} // 现在可以传递了
          getSemesters={getSemesters} // 现在可以传递了
        />
      )}

      {/* 试卷列表 */}
      {papers.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <h4 className="font-medium text-gray-800 mb-3">现有试卷列表</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {papers.map((paper) => (
              <div key={paper.id} className="p-3 bg-gray-50 rounded border">
                <div className="font-medium text-sm">{paper.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {paper.teacher} • {paper.math_category} • {paper.semester}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户状态信息 */}
      {user && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>已登录：</strong>
            {user.emailAddresses?.[0]?.emailAddress}
          </p>
          <p className="text-xs text-green-600 mt-1">
            您可以添加试卷和题目到题库。现在支持LaTeX数学公式！
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionInput;
