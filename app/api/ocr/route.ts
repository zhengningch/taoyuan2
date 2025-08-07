import { NextRequest, NextResponse } from 'next/server';

const API_URL = 'https://chat.ecnu.edu.cn/open/api/v1/chat/completions';
const API_KEY = 'sk-47e5b76f93974df096b3b4763a439718';

export async function POST(request: NextRequest) {
  try {
    const { images } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: '请提供有效的图片数据' },
        { status: 400 }
      );
    }

    if (images.length > 2) {
      return NextResponse.json(
        { error: '最多只能处理2张图片' },
        { status: 400 }
      );
    }

    let allText = '';

    // 处理每张图片
    for (let i = 0; i < images.length; i++) {
      const base64Image = images[i];
      
      const payload = {
        model: 'ecnu-vl',
        messages: [
          {
            role: 'system',
            content: '你是一个擅长ocr的大模型，这是包含了一段文言文的图片。'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请你忠实ocr出包含的文言文原文即可。记住，需要排除手写字的干扰，仅仅集中在印刷体里面。另外，简单整理下，只允许包含基础的标点符号。'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        stream: false
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000) // 30秒超时
      });

      if (!response.ok) {
        console.error(`OCR API请求失败 (图片${i + 1}):`, response.status, await response.text());
        throw new Error(`图片${i + 1}处理失败`);
      }

      const result = await response.json();
      
      if (result.choices && result.choices[0] && result.choices[0].message) {
        const extractedText = result.choices[0].message.content.trim();
        if (extractedText) {
          allText += (allText ? '\n' : '') + extractedText;
        }
      }
    }

    if (!allText.trim()) {
      return NextResponse.json(
        { error: '未能从图片中识别出文字内容' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: allText.trim()
    });

  } catch (error) {
    console.error('OCR处理错误:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: '请求超时，请重试' },
          { status: 408 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}