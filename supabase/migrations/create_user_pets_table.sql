-- 创建用户宠物表
CREATE TABLE IF NOT EXISTS user_pets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_type VARCHAR(20) NOT NULL CHECK (pet_type IN ('cat', 'dog', 'panda', 'squirrel')),
  personality TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id);

-- 启用行级安全策略
ALTER TABLE user_pets ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能访问自己的宠物数据
CREATE POLICY "Users can view own pets" ON user_pets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pets" ON user_pets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pets" ON user_pets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pets" ON user_pets
  FOR DELETE USING (auth.uid() = user_id);

-- 创建触发器函数来自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_user_pets_updated_at
  BEFORE UPDATE ON user_pets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();