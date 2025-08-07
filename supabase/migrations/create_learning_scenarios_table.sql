-- 创建学习情境表
CREATE TABLE IF NOT EXISTS learning_scenarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  original_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'completed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  stage TEXT DEFAULT '正在初始化...',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建学习内容表
CREATE TABLE IF NOT EXISTS scenario_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES learning_scenarios(id) ON DELETE CASCADE,
  reading_guide TEXT,
  video_prompt TEXT,
  image_prompt TEXT,
  video_url TEXT,
  image_url TEXT,
  sentences JSONB, -- 存储处理后的句子数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建学习进度表
CREATE TABLE IF NOT EXISTS learning_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES learning_scenarios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_sentence INTEGER DEFAULT 1,
  completed_sentences INTEGER[] DEFAULT '{}',
  is_completed BOOLEAN DEFAULT FALSE,
  completion_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_learning_scenarios_user_id ON learning_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_scenarios_status ON learning_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_scenario_content_scenario_id ON scenario_content(scenario_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_scenario_id ON learning_progress(scenario_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);

-- 设置行级安全策略
ALTER TABLE learning_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

-- 学习情境策略
CREATE POLICY "Users can view their own learning scenarios" ON learning_scenarios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning scenarios" ON learning_scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning scenarios" ON learning_scenarios
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning scenarios" ON learning_scenarios
  FOR DELETE USING (auth.uid() = user_id);

-- 学习内容策略
CREATE POLICY "Users can view content of their scenarios" ON scenario_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM learning_scenarios 
      WHERE learning_scenarios.id = scenario_content.scenario_id 
      AND learning_scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert content for their scenarios" ON scenario_content
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_scenarios 
      WHERE learning_scenarios.id = scenario_content.scenario_id 
      AND learning_scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update content of their scenarios" ON scenario_content
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM learning_scenarios 
      WHERE learning_scenarios.id = scenario_content.scenario_id 
      AND learning_scenarios.user_id = auth.uid()
    )
  );

-- 学习进度策略
CREATE POLICY "Users can view their own learning progress" ON learning_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning progress" ON learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning progress" ON learning_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning progress" ON learning_progress
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_learning_scenarios_updated_at
  BEFORE UPDATE ON learning_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_progress_updated_at
  BEFORE UPDATE ON learning_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();