// 经典华容道关卡数据（按最少步数从少到多排序）
// 棋盘: 5行4列 (行索引0-4, 列索引0-3)
// shape: [height, width] - 方块高度和宽度
// position: [row, col] - 方块左上角位置
// 出口: 第4行中间两格 [3,1] 和 [3,2]

const KLOTSKI_LEVELS = [
  {
    id: 1,
    name: "过五关",
    description: "关羽过五关斩六将，需要37步",
    minMoves: 37,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [1, 1], color: "#ff6b6b", name: "曹操" },
      { id: "guanyu", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "关羽" },
      { id: "zhangfei", type: "2x1", shape: [2, 1], position: [3, 0], color: "#45b7d1", name: "张飞" },
      { id: "zhaoyun", type: "2x1", shape: [2, 1], position: [3, 3], color: "#45b7d1", name: "赵云" },
      { id: "machao", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "马超" },
      { id: "huangzhong", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "黄忠" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [3, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [3, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [2, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [2, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 2,
    name: "雨声淅沥",
    description: "如雨点般密集的布局，需要47步",
    minMoves: 47,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [0, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "1x2", shape: [1, 2], position: [2, 1], color: "#4ecdc4", name: "横将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "1x2", shape: [1, 2], position: [4, 1], color: "#4ecdc4", name: "横将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [3, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [3, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 3,
    name: "前呼后拥",
    description: "前后夹击的布局，需要51步",
    minMoves: 51,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [1, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "横将" },
      { id: "general2", type: "1x2", shape: [1, 2], position: [3, 1], color: "#4ecdc4", name: "横将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "竖将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [0, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [0, 3], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 2], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 4,
    name: "峰回路转",
    description: "曲折的解法路径，需要55步",
    minMoves: 55,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [2, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "1x2", shape: [1, 2], position: [1, 1], color: "#4ecdc4", name: "横将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "竖将" },
      { id: "general5", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "竖将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [0, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [0, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 2], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 5,
    name: "齐头并进",
    description: "四将齐头并进，需要60步",
    minMoves: 60,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [1, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "横将" },
      { id: "general4", type: "1x2", shape: [1, 2], position: [3, 1], color: "#4ecdc4", name: "横将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [3, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [3, 3], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 6,
    name: "指挥若定",
    description: "曹操居中指挥，需要70步",
    minMoves: 70,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [1, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "横将" },
      { id: "general4", type: "2x1", shape: [2, 1], position: [3, 0], color: "#45b7d1", name: "竖将" },
      { id: "general5", type: "2x1", shape: [2, 1], position: [3, 3], color: "#45b7d1", name: "竖将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [3, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [3, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [2, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [2, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 7,
    name: "兵分三路",
    description: "三路出击的经典阵型，需要72步",
    minMoves: 72,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [0, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "竖将" },
      { id: "general5", type: "1x2", shape: [1, 2], position: [4, 1], color: "#4ecdc4", name: "横将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [2, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [2, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 8,
    name: "将拥曹营",
    description: "众将围绕曹操，需要72步",
    minMoves: 72,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [1, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "横将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "1x2", shape: [1, 2], position: [3, 1], color: "#4ecdc4", name: "横将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [2, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [2, 3], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 2], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 9,
    name: "横刀立马",
    description: "最经典的华容道布局，需要81步",
    minMoves: 81,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [0, 1], color: "#ff6b6b", name: "曹操" },
      { id: "guanyu", type: "1x2", shape: [1, 2], position: [2, 1], color: "#4ecdc4", name: "关羽" },
      { id: "zhangfei", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "张飞" },
      { id: "zhaoyun", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "赵云" },
      { id: "machao", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "马超" },
      { id: "huangzhong", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "黄忠" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [3, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [3, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 0], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 3], color: "#95e1d3", name: "兵" }
    ]
  },
  {
    id: 10,
    name: "近在咫尺",
    description: "曹操近在咫尺却难以脱身，需要82步",
    minMoves: 82,
    blocks: [
      { id: "caocao", type: "2x2", shape: [2, 2], position: [2, 1], color: "#ff6b6b", name: "曹操" },
      { id: "general1", type: "1x2", shape: [1, 2], position: [0, 1], color: "#4ecdc4", name: "横将" },
      { id: "general2", type: "2x1", shape: [2, 1], position: [0, 0], color: "#45b7d1", name: "竖将" },
      { id: "general3", type: "2x1", shape: [2, 1], position: [0, 3], color: "#45b7d1", name: "竖将" },
      { id: "general4", type: "2x1", shape: [2, 1], position: [2, 0], color: "#45b7d1", name: "竖将" },
      { id: "general5", type: "2x1", shape: [2, 1], position: [2, 3], color: "#45b7d1", name: "竖将" },
      { id: "soldier1", type: "1x1", shape: [1, 1], position: [1, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier2", type: "1x1", shape: [1, 1], position: [1, 2], color: "#95e1d3", name: "兵" },
      { id: "soldier3", type: "1x1", shape: [1, 1], position: [4, 1], color: "#95e1d3", name: "兵" },
      { id: "soldier4", type: "1x1", shape: [1, 1], position: [4, 2], color: "#95e1d3", name: "兵" }
    ]
  }
];

// 游戏配置
const KLOTSKI_CONFIG = {
  boardRows: 5,
  boardCols: 4,
  exitPosition: { row: 3, col: 1 },  // 出口在第4行中间两格
  targetBlockId: "caocao"  // 目标是让曹操到达出口
};
