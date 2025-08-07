import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { word, sentence, meaning, dictionaryInfo } = await request.json();

    // 检查必要参数
    if (!word) {
      return NextResponse.json({ error: '缺少必要参数：字' }, { status: 400 });
    }

    // ECNU AI API配置
    const API_KEY = process.env.ECNU_API_KEY;
    const BASE_URL = 'https://chat.ecnu.edu.cn/open/api/v1';

    // 检查API密钥
    if (!API_KEY) {
      console.error('API密钥未配置或使用了默认值');
      return NextResponse.json({
        error: "API密钥未正确配置，请在.env.local文件中设置有效的API_KEY",
      }, { status: 500 });
    }

    // 构建提示词
    let prompt = `请为【字】"${word}"生成一个图像描述指令。`;
    
    if (sentence) {
      prompt += `\n这个字【所在句子】："${sentence}"`;
    }
    
    if (meaning) {
      prompt += `\n【字义】${meaning}`;
    }
    
    if (dictionaryInfo && dictionaryInfo.explanation) {
      prompt += `\n【词典释义】${dictionaryInfo.explanation}`;
    }
    
    prompt += `\n\n为了更好理解某个字的字义，我根据这个字所对应的意思生成一幅像素风、风格的图片。你需要帮我写一份英文的生成图片的指令。
    具体要求：你需要结合【字】、【所在句子】的【字义】、和【词典释义】，挑选某一个比较容易可视化的场景画面，
    注意1、重点放在【所在句子】的【字义】，如果没有的话，就在【词典释义】里面挑选一个意思；2、指令一定是全英文，不要出现任何任何一个中文字符（无论是在何处）；3、一定要以字义为主，重点是解释这个字的字义，不一定要按照原本的【所在句子】的情景。 4、不需要输出其他任何信息，风格强制要求是像素风。5、再次强调，不要出现任何一个中文字符。`;

    const systemPrompt = "你是一个专业的图像描述生成助手，专门为生成合适的图像描述指令，保证像素风、以及不出现任何一个中文字符。";

    // 构建请求数据
    const data = {
      "model": "ecnu-max",
      "messages": [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": prompt}
      ]
    };

    console.log('发送请求到ECNU AI API生成图像描述:', `${BASE_URL}/chat/completions`);

    // 发送请求到ECNU AI API生成图像描述
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ECNU AI API请求失败:', response.status, errorText);
      return NextResponse.json({
        error: `AI服务请求失败: ${response.status}`,
        details: errorText
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('ECNU AI API响应:', result);

    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      console.error('AI响应格式错误:', result);
      return NextResponse.json({ error: 'AI响应格式错误' }, { status: 500 });
    }

    const imagePrompt = result.choices[0].message.content.trim();
    console.log('生成的图像描述:', imagePrompt);

    // 调用图像生成API
    const GITEE_API_KEY = process.env.GITEE_API_KEY;
    const GITEE_IMAGE_URL = 'https://ai.gitee.com/v1';

    if (!GITEE_API_KEY) {
      console.error('Gitee API密钥未配置');
      return NextResponse.json({ error: 'Gitee API密钥未配置' }, { status: 500 });
    }

    console.log('发送图像生成请求到Gitee AI...');
    const imageResponse = await fetch(`${GITEE_IMAGE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITEE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: imagePrompt,
        model: 'flux-1-schnell',
        size: '1024x1024',
        extra_body: {
          guidance_scale: 7.5,
          seed: 42
        }
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error('图像生成API请求失败:', imageResponse.status, errorText);
      return NextResponse.json({
        error: `图像生成失败: ${imageResponse.status}`,
        details: errorText
      }, { status: 500 });
    }

    const imageResult = await imageResponse.json();
    console.log('图像生成API响应:', imageResult);

    let imageUrl = '';
    // 处理base64图片数据
    if (imageResult.data?.[0]?.b64_json) {
      const base64Data = imageResult.data[0].b64_json;
      // 创建data URL格式的图片
      imageUrl = `data:image/jpeg;base64,${base64Data}`;
      console.log('生成的图片数据长度:', base64Data.length);
    } else if (imageResult.data?.[0]?.url) {
      imageUrl = imageResult.data[0].url;
      console.log('提取的图片URL:', imageUrl);
    } else {
      console.log('未找到图片数据');
      return NextResponse.json({ error: '图像生成失败：未找到图片数据' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      imagePrompt: imagePrompt
    });

  } catch (error) {
    console.error('生成复习图片失败:', error);
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}