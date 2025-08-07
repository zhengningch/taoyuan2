-- 创建解锁皮肤表
CREATE TABLE IF NOT EXISTS unlocked_skins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_type TEXT NOT NULL,
  skin_number INTEGER NOT NULL CHECK (skin_number >= 1 AND skin_number <= 8),
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, pet_type, skin_number)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_unlocked_skins_user_id ON unlocked_skins(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_skins_pet_type ON unlocked_skins(pet_type);

-- 设置行级安全策略
ALTER TABLE unlocked_skins ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和操作自己的解锁皮肤
CREATE POLICY "Users can view their own unlocked skins" ON unlocked_skins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unlocked skins" ON unlocked_skins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unlocked skins" ON unlocked_skins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unlocked skins" ON unlocked_skins
  FOR DELETE USING (auth.uid() = user_id);