// QuestionInput/index.js - 重构后的题目录入主组件
import React, { useState, useEffect } from "react";
import { Plus, BookOpen, Upload } from "lucide-react";
import ZipUploadComponent from "./ZipUploadComponent";
import BatchImportForm from "./BatchImportForm";

// 常量定义
const QUESTION_TYPES = ["例题", "习题"];

const QuestionInput = ({ questions, setQuestions, db, user }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [papers, setPapers] = useState([]);

  // 单题表单状态
  const [questionForm, setQuestionForm] = useState({
    paperId: "",
    question_type: "例题",
    question_number: "",
    question_text: "",
    answer: "",
  });

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

  // 加载试卷列表
  useEffect(() => {
    const loadPapers = async () => {
      try {
        const result = await db.getPapers();
        if (result.success) {
          setPapers(result.data || []);
        }
      } catch (error) {
        console.error("加载试卷列表失败:", error);
      }
    };

    if (user) {
      loadPapers();
    }
  }, [db, user]);

  // 单题添加
  const handleSingleQuestionSubmit = async (e) => {
    e.preventDefault();

    if (!questionForm.paperId) {
      alert("请选择试卷");
      return;
    }

    try {
      const result = await db.addQuestion({
        paperId: questionForm.paperId,
        question_type: questionForm.question_type,
        question_number: questionForm.question_number,
        question_text: questionForm.question_text,
        answer: questionForm.answer,
      });

      if (!result.success) throw new Error(result.error);

      // 重新加载题目列表
      const questionsResult = await db.getQuestions();
      if (questionsResult.success) {
        setQuestions(questionsResult.data || []);
      }

      setQuestionForm({
        paperId: "",
        question_type: "例题",
        question_number: "",
        question_text: "",
        answer: "",
      });
      setShowAddForm(false);
      alert("题目添加成功！");
    } catch (error) {
      console.error("添加失败:", error);
      alert("添加失败：" + error.message);
    }
  };

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

      // 解析Markdown格式的题目，传入图片映射
      const parseResult = db.parseMarkdownQuestions(
        batchForm.markdownText,
        imageMap
      );
      if (!parseResult.success) throw new Error(parseResult.error);

      const questions = parseResult.data;
      if (questions.length === 0) {
        throw new Error("没有解析到有效的题目，请检查格式");
      }

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

      // 重新加载试卷列表
      const papersResult = await db.getPapers();
      if (papersResult.success) {
        setPapers(papersResult.data || []);
      }

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
      setImageMap({}); // 清空图片映射
      setShowBatchImport(false);

      // 修复：正确获取导入的题目数量
      const importedQuestions = result.data.questions || [];
      const questionCount = importedQuestions.length;

      alert(`试卷"${title}"创建成功！成功导入 ${questionCount} 道题目！`);
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
    // 不清空图片映射，允许保留已上传的图片
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
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={!canAddQuestions()}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            canAddQuestions()
              ? "bg-blue-500 hover:bg-blue-600 text-white"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          <Plus size={20} />
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
      {showAddForm && canAddQuestions() && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">添加单道题目</h3>
          <form onSubmit={handleSingleQuestionSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择试卷 *
                </label>
                <select
                  value={questionForm.paperId}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      paperId: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">请选择试卷</option>
                  {papers.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.title} - {paper.teacher} ({paper.math_category})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目类型 *
                </label>
                <select
                  value={questionForm.question_type}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      question_type: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题号
                </label>
                <input
                  type="text"
                  value={questionForm.question_number}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      question_number: e.target.value,
                    })
                  }
                  placeholder="例：例1、第1题"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  题目内容 *
                </label>
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      question_text: e.target.value,
                    })
                  }
                  placeholder="请输入题目内容..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={4}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  答案 *
                </label>
                <textarea
                  value={questionForm.answer}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, answer: e.target.value })
                  }
                  placeholder="请输入答案..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                添加题目
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                取消
              </button>
            </div>
          </form>
        </div>
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
            您可以添加试卷和题目到题库。
          </p>
        </div>
      )}
    </div>
  );
};

export default QuestionInput;
