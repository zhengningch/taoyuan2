-- 创建人设表
CREATE TABLE IF NOT EXISTS personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(50) NOT NULL,
  identity VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
CREATE INDEX IF NOT EXISTS idx_personas_is_default ON personas(user_id, is_default);

-- 启用RLS
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Users can view their own personas" ON personas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personas" ON personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personas" ON personas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own personas" ON personas
  FOR DELETE USING (auth.uid() = user_id);

-- 插入一些默认人设选项
INSERT INTO personas (user_id, nickname, identity, tags, is_default) VALUES
  ('00000000-0000-0000-0000-000000000000', '李白', '诗人', ARRAY['豪放', '浪漫'], true),
  ('00000000-0000-0000-0000-000000000000', '孔子', '思想家', ARRAY['智慧', '仁爱'], true),
  ('00000000-0000-0000-0000-000000000000', '武松', '英雄', ARRAY['勇敢', '正义'], true),
  ('00000000-0000-0000-0000-000000000000', '林黛玉', '才女', ARRAY['聪慧', '敏感'], true),
  ('00000000-0000-0000-0000-000000000000', '诸葛亮', '军师', ARRAY['智谋', '忠诚'], true)
ON CONFLICT DO NOTHING;