-- 创建复习卡片表
CREATE TABLE IF NOT EXISTS review_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_review_cards_user_id ON review_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_review_cards_word ON review_cards(word);
CREATE INDEX IF NOT EXISTS idx_review_cards_created_at ON review_cards(created_at);

-- 设置行级安全策略
ALTER TABLE review_cards ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的复习卡片
CREATE POLICY "Users can view their own review cards" ON review_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own review cards" ON review_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review cards" ON review_cards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review cards" ON review_cards
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_review_cards_updated_at
  BEFORE UPDATE ON review_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 防止重复添加相同词条的约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_cards_user_word_unique 
  ON review_cards(user_id, word);