// 魔方新手训练营 - 关卡配置

const LEVELS = [
  // 第1关：认识魔方
  {
    id: 1,
    title: '第1关：认识魔方',
    description: '了解魔方的基本结构和术语',
    steps: [
      {
        title: '欢迎来到魔方训练营！',
        content: `
          <p>恭喜你开始学习魔方！通过这个训练营，你将学会还原三阶魔方。</p>
          <p><strong>学习顺序：</strong></p>
          <ul>
            <li>第1关：认识魔方结构</li>
            <li>第2-7关：逐步还原魔方</li>
            <li>第8关：完整还原训练</li>
          </ul>
        `,
        task: '点击"下一步"开始学习',
        hint: '不要着急，我们会一步一步教你！',
        formula: null,
        scramble: ''
      },
      {
        title: '魔方的基本术语',
        content: `
          <p>首先，让我们认识一下魔方的"语言"：</p>
          <ul>
            <li><strong>R (Right)</strong> = 右面顺时针转90度</li>
            <li><strong>L (Left)</strong> = 左面顺时针转90度</li>
            <li><strong>U (Up)</strong> = 上面顺时针转90度</li>
            <li><strong>D (Down)</strong> = 下面顺时针转90度</li>
            <li><strong>F (Front)</strong> = 前面顺时针转90度</li>
            <li><strong>B (Back)</strong> = 后面顺时针转90度</li>
          </ul>
          <p>带 <strong>'</strong> 表示逆时针，如 <strong>R'</strong> = 右面逆时针</p>
          <p>带 <strong>2</strong> 表示转180度，如 <strong>R2</strong> = 右面转180度</p>
        `,
        task: '记住这些基本术语',
        hint: 'R = 右，L = 左，U = 上，D = 下，F = 前，B = 后',
        formula: null,
        scramble: ''
      },
      {
        title: '试试看：执行你的第一个公式',
        content: `
          <p>现在让我们试试执行一个简单的公式：<strong>R U R' U'</strong></p>
          <p>这个公式的含义是：</p>
          <ul>
            <li>R = 右面顺时针转90度</li>
            <li>U = 上面顺时针转90度</li>
            <li>R' = 右面逆时针转90度</li>
            <li>U' = 上面逆时针转90度</li>
          </ul>
          <p>点击"演示公式"按钮，看看魔方是如何转动的！</p>
        `,
        task: '点击按钮演示公式',
        hint: '观察魔方如何按照公式转动',
        formula: 'R U R\' U\'',
        scramble: ''
      }
    ]
  },

  // 第2关：底层十字
  {
    id: 2,
    title: '第2关：底层十字',
    description: '学习拼好底层白色十字',
    steps: [
      {
        title: '什么是底层十字？',
        content: `
          <p>底层十字是还原魔方的第一步，我们要在底层（白色面）拼出一个白色十字。</p>
          <p><strong>目标：</strong></p>
          <ul>
            <li>底层中心是白色</li>
            <li>4个白色棱块形成十字</li>
            <li>十字的颜色要和中心块对应</li>
          </ul>
          <p><strong>小技巧：</strong>先找到4个白色棱块，一个一个放到正确位置。</p>
        `,
        task: '理解底层十字的概念',
        hint: '白色十字是第一步，先把底层白色中心朝下',
        formula: null,
        scramble: 'R U F D'
      },
      {
        title: '寻找白色棱块',
        content: `
          <p>现在让我们练习找白色棱块：</p>
          <ul>
            <li>白色棱块有4个</li>
            <li>每个棱块有2种颜色</li>
            <li>我们要把它们移到底层</li>
          </ul>
          <p><strong>常用公式（把顶层白色棱块移到底层）：</strong></p>
          <p>F2 - 前面转180度</p>
        `,
        task: '学会使用F2公式',
        hint: 'F2可以把前面的棱块翻到底层',
        formula: 'F2',
        scramble: 'R U F D'
      },
      {
        title: '完成白色十字',
        content: `
          <p>继续练习，直到你能拼出完整的白色十字！</p>
          <p><strong>检查标准：</strong></p>
          <ul>
            <li>✅ 底层有白色十字</li>
            <li>✅ 十字边缘颜色和中心块匹配</li>
          </ul>
          <p>完成后点击"完成本关"进入下一关。</p>
        `,
        task: '拼出完整的白色十字',
        hint: '慢慢来，一次只处理一个棱块',
        formula: null,
        scramble: 'R U F D'
      }
    ]
  },

  // 第3关：底层角块
  {
    id: 3,
    title: '第3关：底层角块',
    description: '完成白色底层（白色面）',
    steps: [
      {
        title: '什么是底层角块？',
        content: `
          <p>现在我们要把白色角块放到底层，完成白色面。</p>
          <p><strong>目标：</strong>整个白色面（底层）全部完成</p>
          <p><strong>常用公式（右下角块归位）：</strong></p>
          <p>R U R' U' - 这是最常用的魔方公式！</p>
        `,
        task: '学习 R U R\' U\' 公式',
        hint: '这个公式会反复用到，一定要记住！',
        formula: 'R U R\' U\'',
        scramble: 'R U R\' U\' F R U R\' U\' F\''
      },
      {
        title: '练习角块归位',
        content: `
          <p>使用 <strong>R U R' U'</strong> 把角块放到正确位置。</p>
          <ul>
            <li>把要处理的角块移到右上前的位置</li>
            <li>执行公式 R U R' U'</li>
            <li>可能需要重复1-5次</li>
          </ul>
        `,
        task: '把4个白色角块都归位',
        hint: '角块归位可能需要重复多次公式',
        formula: 'R U R\' U\'',
        scramble: 'R U R\' U\' F R U R\' U\' F\''
      }
    ]
  },

  // 第4关：中层棱块
  {
    id: 4,
    title: '第4关：中层棱块',
    description: '完成魔方中间层',
    steps: [
      {
        title: '中层棱块公式',
        content: `
          <p>现在白色面（底层）已经完成，我们要处理中层的4个棱块。</p>
          <p><strong>左插公式（棱块放左边）：</strong></p>
          <p>U' L' U L U F U' F'</p>
          <p><strong>右插公式（棱块放右边）：</strong></p>
          <p>U R U' R' U' F' U F</p>
        `,
        task: '学习中层公式',
        hint: '左插和右插公式要区分使用',
        formula: 'U R U\' R\' U\' F\' U F',
        scramble: 'R U R\' U\' R U R\' U\' R U R\' U\''
      }
    ]
  },

  // 第5关：顶层十字
  {
    id: 5,
    title: '第5关：顶层十字',
    description: '在黄色面拼出十字',
    steps: [
      {
        title: '顶层十字公式',
        content: `
          <p>现在要在顶层（黄色面）拼出十字。</p>
          <p><strong>十字公式：</strong></p>
          <p>F R U R' U' F'</p>
          <p>根据顶层黄色的情况，可能需要执行1-3次。</p>
        `,
        task: '拼出黄色十字',
        hint: '观察顶层黄色块的形状，决定要不要转U面',
        formula: 'F R U R\' U\' F\'',
        scramble: 'R U R\' U R U2 R\' F R U R\' U\' F\''
      }
    ]
  },

  // 第6关：顶层面位
  {
    id: 6,
    title: '第6关：顶层面位',
    description: '让黄色面全部朝上',
    steps: [
      {
        title: '顶层面位公式',
        content: `
          <p>现在要把黄色面全部翻朝上。</p>
          <p><strong>面位公式：</strong></p>
          <p>R U R' U R U2 R'</p>
          <p>可能需要重复多次，直到黄色面全部朝上。</p>
        `,
        task: '完成黄色面',
        hint: '把要处理的角块放在右前位置',
        formula: 'R U R\' U R U2 R\'',
        scramble: 'R U R\' U\' R\' F R F\' R U R\' U\' R\' F R F\''
      }
    ]
  },

  // 第7关：顶层角块
  {
    id: 7,
    title: '第7关：顶层角块',
    description: '调整角块位置',
    steps: [
      {
        title: '角块换位公式',
        content: `
          <p>现在要调整黄色角块的位置。</p>
          <p><strong>三角换位公式：</strong></p>
          <p>R B' R F2 R' B R F2 R2</p>
          <p>这个公式可以交换3个角块的位置。</p>
        `,
        task: '把角块移到正确位置',
        hint: '找到已经在正确位置的角块，放在左后位置',
        formula: 'R B\' R F2 R\' B R F2 R2',
        scramble: 'R U R\' U\' R U R\' U\' R U R\' U\''
      }
    ]
  },

  // 第8关：完整还原
  {
    id: 8,
    title: '第8关：完整还原',
    description: '完成最后的棱块调整',
    steps: [
      {
        title: '棱块换位公式',
        content: `
          <p>最后一步！调整顶层棱块位置。</p>
          <p><strong>棱块换位公式：</strong></p>
          <p>F2 U L R' F2 L' R U F2</p>
          <p>完成这一步，魔方就还原了！🎉</p>
        `,
        task: '完成魔方还原！',
        hint: '把需要交换的棱块放在前后位置',
        formula: 'F2 U L R\' F2 L\' R U F2',
        scramble: 'R U R\' U\' R U R\' U\' R U R\' U\''
      },
      {
        title: '恭喜你学会了还原魔方！',
        content: `
          <p>🎉 太棒了！你已经完成了所有关卡！</p>
          <p><strong>现在你已经学会：</strong></p>
          <ul>
            <li>✅ 认识魔方术语</li>
            <li>✅ 底层十字</li>
            <li>✅ 底层角块</li>
            <li>✅ 中层棱块</li>
            <li>✅ 顶层十字</li>
            <li>✅ 顶层面位</li>
            <li>✅ 顶层角块</li>
            <li>✅ 完整还原</li>
          </ul>
          <p><strong>接下来：</strong></p>
          <p>多多练习，熟能生巧！你可以点击"随机打乱"来练习完整还原。</p>
        `,
        task: '继续练习，提高速度！',
        hint: '恭喜毕业！现在是时候提速了！',
        formula: null,
        scramble: ''
      }
    ]
  }
];

// 导出给其他文件使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVELS };
}
