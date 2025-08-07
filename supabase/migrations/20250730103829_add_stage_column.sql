-- Add stage column to learning_scenarios table
ALTER TABLE learning_scenarios 
ADD COLUMN stage TEXT DEFAULT '正在初始化...';