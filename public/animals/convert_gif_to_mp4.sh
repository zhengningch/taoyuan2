#!/bin/bash

# 批量将gif文件转换为mp4
echo "开始批量转换gif文件为mp4..."

# 计数器
count=0
total=$(find /Users/zhuoning/taoyuan2/public/animals -name "*.gif" -type f | wc -l)

echo "总共找到 $total 个gif文件需要转换"

# 遍历所有gif文件
find /Users/zhuoning/taoyuan2/public/animals -name "*.gif" -type f | while read gif_file; do
    # 获取不带扩展名的文件名
    base_name="${gif_file%.*}"
    mp4_file="${base_name}.mp4"
    
    count=$((count + 1))
    echo "[$count/$total] 正在转换: $(basename "$gif_file")"
    
    # 使用ffmpeg转换gif为mp4
    ffmpeg -i "$gif_file" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "$mp4_file" -y -loglevel error
    
    if [ $? -eq 0 ]; then
        echo "✓ 转换成功: $mp4_file"
    else
        echo "✗ 转换失败: $gif_file"
    fi
done

echo "批量转换完成！"