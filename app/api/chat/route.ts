import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages }: ChatRequest = await request.json();

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    const response = await fetch('https://ai.gitee.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GITEE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'DeepSeek-R1',
        messages: messages,
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: ${response.status}`, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    // 创建一个可读流来处理 SSE 响应
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"抱歉，我现在无法回答您的问题，请稍后再试。"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        try {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // 保留最后一个不完整的行
            
            for (const line of lines) {
              if (line.trim() && line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  return;
                }
                if (data && data !== '') {
                  try {
                    // 验证 JSON 格式
                    JSON.parse(data);
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  } catch (e) {
                    // 忽略无效的 JSON
                    console.warn('Invalid JSON in stream:', data);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          // 发送错误消息
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"抱歉，处理您的请求时出现了错误。"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}