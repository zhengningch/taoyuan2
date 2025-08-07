import { createClient } from '@supabase/supabase-js';

// 从环境变量中获取Supabase URL和匿名密钥
// 注意：这些密钥应保持安全，不要硬编码
// 使用环境变量以保护敏感信息
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 创建Supabase客户端实例
// 这个客户端用于所有认证和数据库操作
export const supabase = createClient(supabaseUrl, supabaseAnonKey);