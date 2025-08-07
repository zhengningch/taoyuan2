"use client";  // 标记为客户端组件，以使用React钩子
import Image from "next/image";
import { VideoBackground } from "@/components/VideoBackground";  // 导入视频背景组件
import { useState } from "react";  // 用于管理登录模态状态
import { AuthModal } from "@/components/AuthModal";  // 导入认证模态组件
import { useRouter } from "next/navigation";  // 用于页面跳转

// 首页组件
export default function Home() {
  const [showLogin, setShowLogin] = useState(false);  // 控制登录/注册模态的显示
  const router = useRouter();  // 路由实例

  // 处理登录/注册成功
  const handleSuccess = () => {
    setShowLogin(false);  // 关闭模态
    router.push('/dashboard');  // 跳转到主界面
  };

  return (
    <div className="relative min-h-screen overflow-hidden">  {/* 相对定位容器，确保视频背景覆盖整个屏幕 */}
      <VideoBackground />  {/* 背景视频，循环播放，速度减慢 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">  {/* 内容层，置于视频上方 */}
        <Image
          src="/name.png"  // 中间嵌入的图片
          alt="桃源名称"  // 图片描述
          width={300}  // 调整宽度，根据实际图片大小
          height={100}  // 调整高度
          priority  // 优先加载
        />
        <button
          onClick={() => setShowLogin(true)}  // 点击显示登录模态
          className="mt-8 px-6 py-3 bg-red-800 text-white rounded-lg hover:bg-red-700 transition"  // 红褐色按钮样式
        >
          进入桃源  {/* 按钮文本 */}
        </button>
      </div>
      <AuthModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={handleSuccess}  // 成功后跳转
      />  {/* 登录/注册模态 */}
    </div>
  );
}
