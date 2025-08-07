import { supabase } from './supabase';

export interface PetData {
  id?: string;
  user_id: string;
  pet_type: 'cat' | 'dog' | 'panda' | 'squirrel';
  personality: string[];
  user_nickname?: string;
  pet_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 获取用户的宠物数据
export async function getUserPet(userId: string): Promise<PetData | null> {
  try {
    const { data, error } = await supabase
      .from('user_pets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 没有找到记录
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user pet:', error);
    return null;
  }
}

// 保存用户的宠物数据
export async function saveUserPet(petData: Omit<PetData, 'id' | 'created_at' | 'updated_at'>): Promise<PetData | null> {
  try {
    const { data, error } = await supabase
      .from('user_pets')
      .upsert({
        user_id: petData.user_id,
        pet_type: petData.pet_type,
        personality: petData.personality,
        user_nickname: petData.user_nickname,
        pet_name: petData.pet_name,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error saving user pet:', error);
    return null;
  }
}

// 检查用户是否已经选择了宠物
export async function checkUserHasPet(userId: string): Promise<boolean> {
  const pet = await getUserPet(userId);
  return pet !== null;
}