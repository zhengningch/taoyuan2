import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';  // 导入Supabase客户端

// 认证模态组件
// 处理用户注册和登录，使用email和密码，支持用户名输入
export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(true);  // 切换注册/登录模式
  const [email, setEmail] = useState('');  // 用户邮箱
  const [password, setPassword] = useState('');  // 用户密码

  const [error, setError] = useState<string | null>(null);  // 错误消息
  const [message, setMessage] = useState<string | null>(null);  // 成功消息

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (isRegister) {
      // 注册逻辑
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      setMessage('注册成功！请检查邮箱验证。');
      onSuccess();  // 成功回调
    } else {
      // 登录逻辑
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      onSuccess();  // 成功回调
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-sm w-full">
        <h2 className="text-2xl mb-4">{isRegister ? '注册' : '登录'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            required
          />

          <button type="submit" className="w-full bg-red-800 text-white p-2 rounded">
            {isRegister ? '注册' : '登录'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="mt-4 text-blue-500">
          {isRegister ? '已有账号？登录' : '没有账号？注册'}
        </button>
        {error && <p className="mt-2 text-red-500">{error}</p>}
        {message && <p className="mt-2 text-green-500">{message}</p>}
        <button onClick={onClose} className="mt-4 text-gray-500">关闭</button>
      </div>
    </div>
  );
};