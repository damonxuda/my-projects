// BatchImportForm.js - 批量导入表单组件
import React from "react";

// 常量定义
const MATH_CATEGORIES = [
  "计算",
  "计数",
  "几何",
  "数论",
  "应用题",
  "行程",
  "组合",
];

const BatchImportForm = ({
  batchForm,
  setBatchForm,
  imageMap,
  onSubmit,
  onCancel,
}) => {
  const handleSubmit = (e) => {
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

    onSubmit(e, imageMap);
  };

  return (
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
          题目内容（支持新旧格式的Markdown）*
        </label>
        <textarea
          value={batchForm.markdownText}
          onChange={(e) =>
            setBatchForm({ ...batchForm, markdownText: e.target.value })
          }
          placeholder={`请粘贴标准MD格式题目：

[EX1]
如图所示，正方形ABCD的边长为6cm...

[IMG:01.png]

求阴影部分的面积。

答案：18平方厘米

---

[HW1]
观察下面的三角形...

[IMG:02.png]

答案：...

---

[EX1-1]
计算下列表格中的数据...

[TABLE]
| 项目 | 数值 |
|------|------|
| A    | 10   |
| B    | 20   |

答案：...`}
          className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
          rows={15}
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
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
        >
          批量导入试卷
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
  );
};

export default BatchImportForm;
