// 经典华容道关卡数据（基于维基百科引用的同济大学数学建模协会数据）
// 数据来源: https://zh.wikipedia.org/zh-hans/華容道_(遊戲)
// 参考: https://github.com/SimonHung/Klotski
//
// 重要说明：
// 1. 参考最少步数来源于同济大学数学建模协会第6期会刊
// 2. 该步数统计规则为：1x1小兵连续移动多格只算1步
// 3. 本游戏实现为：每移动1格算1步，因此实际步数可能多于参考值
//
// 棋盘: 5行4列 (行索引0-4, 列索引0-3)
// 出口: 第4行中间两格 [3,1] 和 [3,2]
//
// 武将命名：横将-关羽；竖将-张飞、赵云、马超、黄忠

const KLOTSKI_LEVELS = [
  {
    "id": 1,
    "name": "捷足先登",
    "minMoves": 32,
    "description": "最简单的布局，参考最少32步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      }
    ]
  },
  {
    "id": 2,
    "name": "一路顺风",
    "minMoves": 39,
    "description": "一路顺风布局，参考最少39步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 3,
    "name": "小燕出巢",
    "minMoves": 43,
    "description": "小燕出巢布局，参考最少43步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          1,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          3,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 4,
    "name": "雨声淅沥",
    "minMoves": 47,
    "description": "如雨点般密集的布局，参考最少47步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 5,
    "name": "左右布兵",
    "minMoves": 54,
    "description": "左右布兵布局，参考最少54步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      }
    ]
  },
  {
    "id": 6,
    "name": "一路进军",
    "minMoves": 58,
    "description": "一路进军布局，参考最少58步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      }
    ]
  },
  {
    "id": 7,
    "name": "齐头并进",
    "minMoves": 60,
    "description": "四将齐头并进，参考最少60步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          3,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      }
    ]
  },
  {
    "id": 8,
    "name": "指挥若定",
    "minMoves": 70,
    "description": "曹操居中指挥，参考最少70步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      }
    ]
  },
  {
    "id": 9,
    "name": "桃花园中",
    "minMoves": 70,
    "description": "桃花园中布局，参考最少70步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      }
    ]
  },
  {
    "id": 10,
    "name": "旗开得胜",
    "minMoves": 70,
    "description": "旗开得胜布局，参考最少70步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 11,
    "name": "兵分三路",
    "minMoves": 72,
    "description": "三路出击的经典阵型，参考最少72步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      }
    ]
  },
  {
    "id": 12,
    "name": "将拥曹营",
    "minMoves": 72,
    "description": "众将围绕曹操，参考最少72步",
    "blocks": [
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          0
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 13,
    "name": "兵挫曹营",
    "minMoves": 78,
    "description": "兵挫曹营布局，参考最少78步",
    "blocks": [
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 14,
    "name": "横刀立马",
    "minMoves": 81,
    "description": "最经典的华容道布局，参考最少81步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 15,
    "name": "云遮雾障",
    "minMoves": 81,
    "description": "云遮雾障布局，参考最少81步",
    "blocks": [
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 16,
    "name": "天兵神将",
    "minMoves": 82,
    "description": "天兵神将布局，参考最少82步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          1,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          3,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 17,
    "name": "双将挺进",
    "minMoves": 82,
    "description": "双将挺进布局，参考最少82步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          1,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          3,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 18,
    "name": "陷入包围",
    "minMoves": 90,
    "description": "陷入包围布局，参考最少90步",
    "blocks": [
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          0
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          1,
          1
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          0
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          3,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 19,
    "name": "层层设防",
    "minMoves": 102,
    "description": "层层设防布局，参考最少102步",
    "blocks": [
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          0
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          2,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          3,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          4,
          1
        ],
        "color": "#95e1d3",
        "name": "兵"
      }
    ]
  },
  {
    "id": 20,
    "name": "步步为营一",
    "minMoves": 106,
    "description": "步步为营布局，参考最少106步",
    "blocks": [
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          0
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          3,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      }
    ]
  },
  {
    "id": 21,
    "name": "步步为营二",
    "minMoves": 116,
    "description": "最难的布局，参考最少116步",
    "blocks": [
      {
        "id": "caocao",
        "type": "2x2",
        "shape": [
          2,
          2
        ],
        "position": [
          0,
          0
        ],
        "color": "#ff6b6b",
        "name": "曹操"
      },
      {
        "id": "soldier1",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier2",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          0,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier3",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          2
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "soldier4",
        "type": "1x1",
        "shape": [
          1,
          1
        ],
        "position": [
          1,
          3
        ],
        "color": "#95e1d3",
        "name": "兵"
      },
      {
        "id": "vertical1",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          0
        ],
        "color": "#45b7d1",
        "name": "张飞"
      },
      {
        "id": "vertical2",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          1
        ],
        "color": "#45b7d1",
        "name": "赵云"
      },
      {
        "id": "vertical3",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          2
        ],
        "color": "#45b7d1",
        "name": "马超"
      },
      {
        "id": "vertical4",
        "type": "2x1",
        "shape": [
          2,
          1
        ],
        "position": [
          2,
          3
        ],
        "color": "#45b7d1",
        "name": "黄忠"
      },
      {
        "id": "horizontal1",
        "type": "1x2",
        "shape": [
          1,
          2
        ],
        "position": [
          4,
          1
        ],
        "color": "#4ecdc4",
        "name": "关羽"
      }
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
