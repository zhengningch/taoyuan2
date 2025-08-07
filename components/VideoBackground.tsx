"use client";  // 标记为客户端组件
import React, { useRef, useEffect } from 'react';

// 视频背景组件
// 用于显示循环播放的背景视频，速度减慢一倍，确保过渡流畅
export const VideoBackground: React.FC<{ slowed?: boolean; className?: string }> = ({ slowed = true, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // 设置播放速度
      video.playbackRate = slowed ? 0.5 : 1;
      
      // 尝试自动播放
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.warn('Auto-play was prevented:', error);
        });
      }
    }
  }, [slowed]);

  return (
    <div className={`absolute top-0 left-0 w-full h-full overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src="/background.mp4"  // 视频文件路径，从public文件夹加载
        autoPlay  // 自动播放
        loop  // 循环播放
        muted  // 静音
        playsInline  // 支持移动端内联播放
        className="w-full h-full object-cover"  // 满屏覆盖样式
        onError={(e) => console.warn('Video error:', e)}
      />
    </div>
  );
};