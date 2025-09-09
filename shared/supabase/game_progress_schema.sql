-- 游戏进度表结构
-- 用于存储用户的游戏进度数据，支持多种游戏类型

-- 创建游戏进度表
CREATE TABLE IF NOT EXISTS public.game_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL, -- Clerk用户ID
  game VARCHAR(50) NOT NULL, -- 游戏类型 (sudoku, nonogram, etc.)
  data_key VARCHAR(100) NOT NULL, -- 数据键 (progress, settings, stats)
  data JSONB NOT NULL, -- 游戏数据（JSON格式）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 创建复合唯一约束，确保每个用户每个游戏的每种数据类型只有一条记录
  CONSTRAINT unique_user_game_key UNIQUE (user_id, game, data_key)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON public.game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_game ON public.game_progress(game);
CREATE INDEX IF NOT EXISTS idx_game_progress_user_game ON public.game_progress(user_id, game);
CREATE INDEX IF NOT EXISTS idx_game_progress_updated_at ON public.game_progress(updated_at);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_game_progress_updated_at ON public.game_progress;
CREATE TRIGGER update_game_progress_updated_at
    BEFORE UPDATE ON public.game_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略 (RLS)
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能访问自己的数据
DROP POLICY IF EXISTS "Users can view own game progress" ON public.game_progress;
CREATE POLICY "Users can view own game progress" ON public.game_progress
    FOR SELECT USING (user_id = current_setting('request.jwt.claim.sub', true));

DROP POLICY IF EXISTS "Users can insert own game progress" ON public.game_progress;
CREATE POLICY "Users can insert own game progress" ON public.game_progress
    FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

DROP POLICY IF EXISTS "Users can update own game progress" ON public.game_progress;
CREATE POLICY "Users can update own game progress" ON public.game_progress
    FOR UPDATE USING (user_id = current_setting('request.jwt.claim.sub', true));

DROP POLICY IF EXISTS "Users can delete own game progress" ON public.game_progress;
CREATE POLICY "Users can delete own game progress" ON public.game_progress
    FOR DELETE USING (user_id = current_setting('request.jwt.claim.sub', true));

-- 创建管理员策略：管理员可以查看所有数据
DROP POLICY IF EXISTS "Admins can view all game progress" ON public.game_progress;
CREATE POLICY "Admins can view all game progress" ON public.game_progress
    FOR SELECT USING (
        current_setting('request.jwt.claim.email', true) IN (
            'ops@damonxuda.site'  -- 添加管理员邮箱
        )
    );

-- 示例数据结构注释
/*
数独游戏进度数据结构示例：

user_id: "user_2abc123"
game: "sudoku" 
data_key: "progress"
data: {
  "easy": {
    "current_level": 15,
    "completed_levels": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    "level_records": {
      "1": { "time": 180, "stars": 3, "completed_at": 1642567890000 },
      "2": { "time": 240, "stars": 2, "completed_at": 1642567990000 },
      ...
    }
  },
  "medium": { ... },
  "hard": { ... },
  "expert": { ... },
  "master": { ... }
}

数独游戏设置数据结构示例：

user_id: "user_2abc123"
game: "sudoku"
data_key: "settings"
data: {
  "difficulty": "medium",
  "hints": true,
  "autoValidate": true,
  "theme": "light",
  "vibration": true,
  "sound": true
}

数独游戏统计数据结构示例：

user_id: "user_2abc123"
game: "sudoku"
data_key: "stats"
data: {
  "gamesPlayed": 50,
  "gamesWon": 45,
  "totalPlayTime": 18000000,
  "bestTimes": {
    "easy": 120000,
    "medium": 180000,
    "hard": 300000,
    "expert": 450000,
    "master": 600000
  },
  "starsEarned": {
    "easy": 45,
    "medium": 32,
    "hard": 18,
    "expert": 8,
    "master": 2
  }
}
*/