-- 为learning_progress表添加皮肤抽取状态字段
ALTER TABLE learning_progress 
ADD COLUMN skin_drawn BOOLEAN DEFAULT FALSE;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_learning_progress_skin_drawn ON learning_progress(skin_drawn);

-- 添加注释
COMMENT ON COLUMN learning_progress.skin_drawn IS '是否已抽取过皮肤，每个学习进度只能抽取一次';