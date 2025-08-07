import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://chat.ecnu.edu.cn/open/api/v1';
const API_KEY = process.env.ECNU_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { dictionary_info, persona } = await request.json();

    if (!dictionary_info || !persona) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { success: false, error: 'API密钥未配置' },
        { status: 500 }
      );
    }

    // 构建人设描述
    // 构建人设描述
    const personaDescription = persona 
      ? `一个名叫"${persona.nickname}"的、性格标签是${persona.tags.join('、')}的${persona.identity}`
      : '古代人物';

    // 构建系统提示
    const systemPrompt = `你是优秀的高中语文老师，我的待处理字和词典信息是"${JSON.stringify(dictionary_info)}"，请你根据这些信息，围绕这个【字】，生成一个全新的文言文情景，考察学生的掌握情况。注意：1、文言文的主角需要是${personaDescription}2、保证题目正确。3、严格按照以下示例格式输出情境和两道选择题： 
 【文言文情境】  
 航海家宁率众出海，遇飓风，船队困于茫茫大海。淡水将尽，众船员惶恐不安。宁临危不惧，指远处云气曰："吾观天象，三日內必有大雨，当决渎蓄水，以解燃眉之急。"果如其言，暴雨至，宁命人凿船板导水入舱，众得救。后至异邦，国王以珍宝赠之，宁决然辞曰："航海者，志在四方，岂为财帛？"遂扬帆而去。  
 
 【选择题1】  
 下列句中"决"字与宁"决渎蓄水"中用法相同的是：  
 A. 孔子不能决也（《两小儿辩日》）  
 B. 鲧禹决渎（《五蠹》）  
 C. 予分当引决（《指南录后序》）  
 D. 孤当与孟德决之（《赤壁之战》）  
 【答案1】B  
 
 【选择题2】  
 宁"决然辞曰"中"决"的含义是：  
 A. 疏通水道  
 B. 决定  
 C. 辞别  
 D. 必定  
 【答案2】C 
 
 请确保每个部分都使用正确的标签包裹，这对前端解析非常重要。`;

    const message = '请生成考试内容';

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
      console.error('ECNU AI API错误响应:', errorText);
      return NextResponse.json(
        { success: false, error: `API请求失败: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    console.log('ECNU AI API响应:', result);

    if (result.choices && result.choices[0] && result.choices[0].message) {
      const content = result.choices[0].message.content;
      
      // 解析生成的内容
      const parsedContent = parseExamContent(content);
      
      return NextResponse.json({
        success: true,
        content: parsedContent
      });
    } else {
      console.error('API响应格式异常:', result);
      return NextResponse.json(
        { success: false, error: 'API响应格式异常' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('生成考试内容失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 分离题目和选项
function parseQuestionAndOptions(questionText: string) {
  // 匹配题目部分（到第一个选项A之前的内容）
  const questionMatch = questionText.match(/^([\s\S]*?)(?=\s*A\.|$)/);
  const question = questionMatch ? questionMatch[1].trim() : questionText;
  
  // 提取选项
  const options = {
    A: '',
    B: '',
    C: '',
    D: ''
  };
  
  const optionAMatch = questionText.match(/A\.\s*([^\n]*(?:\n(?!\s*[BCD]\.).*)*)/);
  const optionBMatch = questionText.match(/B\.\s*([^\n]*(?:\n(?!\s*[CD]\.).*)*)/);
  const optionCMatch = questionText.match(/C\.\s*([^\n]*(?:\n(?!\s*D\.).*)*)/);
  const optionDMatch = questionText.match(/D\.\s*([\s\S]*?)$/);
  
  if (optionAMatch) options.A = optionAMatch[1].trim();
  if (optionBMatch) options.B = optionBMatch[1].trim();
  if (optionCMatch) options.C = optionCMatch[1].trim();
  if (optionDMatch) options.D = optionDMatch[1].trim();
  
  return {
    question,
    options
  };
}

// 解析考试内容
function parseExamContent(content: string) {
  try {
    // 提取文言文情境
    const contextMatch = content.match(/【文言文情境】\s*([\s\S]*?)(?=【选择题1】|$)/);
    const context = contextMatch ? contextMatch[1].trim() : '';

    // 提取选择题1 (从【选择题1】到【答案1】之前的内容)
    const question1Match = content.match(/【选择题1】\s*([\s\S]*?)(?=【答案1】)/);
    const question1Raw = question1Match ? question1Match[1].trim() : '';
    
    // 从选择题1中分离题目和选项
    const question1Parts = parseQuestionAndOptions(question1Raw);
    
    // 提取答案1
    const answer1Match = content.match(/【答案1】\s*([A-D])/);
    const answer1 = answer1Match ? answer1Match[1] : '';

    // 提取选择题2 (从【选择题2】到【答案2】之前的内容)
    const question2Match = content.match(/【选择题2】\s*([\s\S]*?)(?=【答案2】)/);
    const question2Raw = question2Match ? question2Match[1].trim() : '';
    
    // 从选择题2中分离题目和选项
    const question2Parts = parseQuestionAndOptions(question2Raw);
    
    // 提取答案2
    const answer2Match = content.match(/【答案2】\s*([A-D])/);
    const answer2 = answer2Match ? answer2Match[1] : '';

    return {
      context,
      questions: [
        {
          question: question1Parts.question,
          options: question1Parts.options,
          answer: answer1
        },
        {
          question: question2Parts.question,
          options: question2Parts.options,
          answer: answer2
        }
      ],
      rawContent: content
    };
  } catch (error) {
    console.error('解析考试内容失败:', error);
    return {
      context: '',
      questions: [],
      rawContent: content
    };
  }
}