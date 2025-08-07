-- 为复习卡片表添加错题收集相关字段
ALTER TABLE review_cards 
ADD COLUMN IF NOT EXISTS sentence TEXT,
ADD COLUMN IF NOT EXISTS meaning TEXT,
ADD COLUMN IF NOT EXISTS dictionary_info JSONB,
ADD COLUMN IF NOT EXISTS source_scenario_id UUID,
ADD COLUMN IF NOT EXISTS mistake_count INTEGER DEFAULT 1;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_review_cards_source_scenario ON review_cards(source_scenario_id);
CREATE INDEX IF NOT EXISTS idx_review_cards_mistake_count ON review_cards(mistake_count);

-- 更新唯一约束，现在基于用户、单字和来源情境
DROP INDEX IF EXISTS idx_review_cards_user_word_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_cards_user_word_scenario_unique 
  ON review_cards(user_id, word, source_scenario_id);