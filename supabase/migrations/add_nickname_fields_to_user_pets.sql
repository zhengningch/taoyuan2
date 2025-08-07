-- 为用户宠物表添加昵称字段
ALTER TABLE user_pets 
ADD COLUMN IF NOT EXISTS user_nickname VARCHAR(50),
ADD COLUMN IF NOT EXISTS pet_name VARCHAR(50);

-- 为新字段添加注释
COMMENT ON COLUMN user_pets.user_nickname IS '宠物对用户的称呼';
COMMENT ON COLUMN user_pets.pet_name IS '宠物的名字';