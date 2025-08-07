import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: '缺少消息内容' }, { status: 400 });
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

    // 为范文生成使用的系统提示，不受宠物类型影响
    const systemPrompt = `##Description:你是一名优秀的高三语文作文写作者。现在你需要处理的是｛生成范文｝任务。请你根据我所提供的｛句子｝，严格按照以下的｛Constrains｝，生成一段｛高中思辨类作文｝的段落例文。
## Constrains：

1，请注意语言的优美、文雅。如果可以的话，尽量多使用对仗，多点整散结合，也可以使用一些《文言词汇》，这样子表达更加优雅。务必使得语言凝练，优美，简洁。
2，观点也要思辨一些。年级是高三，因此语言需要复杂，高级，观点要立体，有层次。可以加《一些哲学黑话》，但一定要把握好尺度，要完美融合在段落中。
3，我给你的句子可能是某个事例，也可能是一句名言，你可以单纯从这句话出发，同时也可以引申能够与之对照的其他例子予以辅助论述。但是如果要生成另外的例子的话，一定要保证是真实可查的信息，而非编造。
4，你的范文可以不直接以我的句子开头，而是非常好得镶嵌在段落中间。为了让我的句子和你的段落比较完美融合，需要用一些恰如其分的连接词。你可以参考"示例"的方式。
5，在你所生成的范文最末尾，以括号()形式说明这个范文可以被用在什么主题关键词的题目之中。
6，绝对禁止：出现"揭示了"、"此语道尽"等。同样禁止，使用"这不仅，···更/亦是···"，你应该去选择更加连贯的关联词。

## 示例
input：你的待处理句子是：尼采说："有的人死后方生，我的时代还没有到来"。
output：
纵观历史，我们依然可以看到，曾有许多人在追求认可度并不高的事物，完成了生命力量的完满。顶着他人片面的判断实现了人生的超越。如尼采曾扬言："有的人死后方生，我的时代还没有到来。"以笃定的信念构建起超人精神的内核；又如史铁生"且视他人疑目，如盏盏鬼火，大胆地去走你的夜路。"用残缺的身体超越了生死隔阂。他们所追求的并非是世人眼中认可赞扬的东西，但是却能跨越时间，回荡于未来。（认可度）


输出前请严格审核是否满足所有约束条件！`;

    // 构建请求数据
    const data = {
      "model": "ecnu-max",
      "messages": [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": message}
      ]
    };

    console.log('发送请求到ECNU AI API:', `${BASE_URL}/chat/completions`);

    // 发送请求到ECNU AI API
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(data)
    });

    console.log('ECNU AI API响应状态码:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API请求失败:', response.status, errorText);
      
      // 处理常见的API错误
      if (response.status === 401) {
        return NextResponse.json({
          error: "API密钥无效，请检查.env.local文件中的API_KEY设置",
          details: errorText
        }, { status: 500 });
      } else if (response.status === 429) {
        return NextResponse.json({
          error: "API请求超出限制，请稍后再试",
          details: errorText
        }, { status: 500 });
      }
      
      throw new Error(`API请求失败: ${response.status}`);
    }

    const responseData = await response.json();
    
    // 提取AI回复
    const ai_reply = responseData.choices?.[0]?.message?.content;
    
    if (!ai_reply) {
      throw new Error('AI响应格式错误');
    }

    return NextResponse.json({ reply: ai_reply });
    
  } catch (error: any) {
    console.error('Error in essay API:', error.message);
    
    return NextResponse.json({
      error: "与AI服务通信时出错，请稍后再试。",
      details: error.message
    }, { status: 500 });
  }
}