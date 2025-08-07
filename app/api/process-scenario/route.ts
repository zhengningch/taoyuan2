import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 创建服务角色客户端，用于绕过RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const ECNU_API_URL = 'https://chat.ecnu.edu.cn/open/api/v1/chat/completions';
const ECNU_API_KEY = process.env.ECNU_API_KEY!;

const GITEE_API_KEY = process.env.GITEE_API_KEY!;
const GITEE_IMAGE_URL = 'https://ai.gitee.com/v1';
const GITEE_VIDEO_URL = 'https://ai.gitee.com/v1/async/videos/generations';

interface SentenceData {
  sentence: string;
  translation: string;
  annotation: string;
  keyPoints: string;
  isImportant: boolean;
  punctuationExercise?: string;
  questions?: Array<{
    question: string;
    options: string[];
    answer: string;
  }>;
  dictionaryContext?: Array<{
    word: string;
    explanation: string;
  }>;
  kaodianContext?: Array<{
    source: string;
    word: string;
    sentence: string;
    meaning: string;
  }>;
  examAnalysis?: string;
}

// 调用ECNU-Plus模型
async function callECNUPlus(prompt: string, systemPrompt: string = '你是一名出色的高中语文老师，请你按照指定的结构输出内容.') {
  const response = await fetch(ECNU_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ECNU_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'ecnu-max',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    }),
    signal: AbortSignal.timeout(600000) // 10分钟超时
  });

  if (!response.ok) {
    throw new Error(`ECNU API请求失败: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.choices || result.choices.length === 0) {
    throw new Error('ECNU API返回数据格式错误：缺少choices字段');
  }
  
  if (!result.choices[0].message || !result.choices[0].message.content) {
    throw new Error('ECNU API返回数据格式错误：缺少message内容');
  }
  
  return result.choices[0].message.content;
}

// 调用DeepSeek模型（带重试机制）
async function callDeepSeekR1(prompt: string, systemPrompt: string = '你是一名出色的高中语文老师，请你按照指定的结构输出内容。') {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`DeepSeek API调用尝试 ${attempt}/${maxRetries}`);
      
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分钟超时

      const response = await fetch('https://chat.ecnu.edu.cn/open/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ECNU_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'ecnu-reasoner',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          stream: false,
          max_tokens: 8192,
          temperature: 0.7,
          top_p: 0.7,
          top_k: 50,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API请求失败: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.choices || result.choices.length === 0) {
        throw new Error('DeepSeek API返回数据格式错误：缺少choices字段');
      }
      
      if (!result.choices[0].message || !result.choices[0].message.content) {
        throw new Error('DeepSeek API返回数据格式错误：缺少message内容');
      }
      
      console.log(`DeepSeek API调用成功，尝试次数: ${attempt}`);
      return result.choices[0].message.content;
      
    } catch (error) {
      lastError = error;
      console.error(`DeepSeek API调用失败，尝试 ${attempt}/${maxRetries}:`, error);
      
      if (attempt < maxRetries) {
        // 等待一段时间后重试
        const waitTime = attempt * 2000; // 递增等待时间：2秒、4秒
        console.log(`等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw new Error(`DeepSeek API调用失败，已重试 ${maxRetries} 次。最后错误: ${lastError}`);
}

// 验证JSON格式
function validateFormat1(text: string) {
  try {
    // 处理被```json包裹的情况
    let jsonText = text.trim();
    if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
      jsonText = jsonText.slice(7, -3).trim();
    } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
      jsonText = jsonText.slice(3, -3).trim();
    }
    
    // 检查是否为空或无效的JSON字符串
    if (!jsonText || jsonText.length === 0) {
      console.log('JSON文本为空');
      return false;
    }
    
    const parsed = JSON.parse(jsonText);
    const isValid = parsed && 
                   typeof parsed === 'object' && 
                   parsed.阅前指南 && 
                   parsed.视频 && 
                   parsed.图像 && 
                   parsed.诗句;
    
    if (!isValid) {
      console.log('JSON格式验证失败，缺少必要字段:', parsed);
    }
    
    return isValid;
  } catch (error) {
    console.log('validateFormat1 JSON解析错误:', error);
    return false;
  }
}

// 验证句子格式
function validateFormat2(text: string) {
  const sentencePattern = /【句\d+】[\s\S]*?【翻译】[\s\S]*?【注解】[\s\S]*?【考点】[\s\S]*?(?=【句\d+】|$)/g;
  return sentencePattern.test(text);
}

// 验证题目格式
function validateFormat3(text: string) {
  const questionPattern = /【考题\d+】[\s\S]*?【答案\d+】/g;
  return questionPattern.test(text);
}

// 解析句子数据（异步版本，包含词典查询）
async function parseSentences(text: string): Promise<SentenceData[]> {
  const sentences: SentenceData[] = [];
  const sentencePattern = /【句(\d+)】([\s\S]*?)【翻译】([\s\S]*?)【注解】([\s\S]*?)【考点】([\s\S]*?)(?=【句\d+】|$)/g;
  
  let match;
  while ((match = sentencePattern.exec(text)) !== null) {
    const [, num, sentence, translation, annotation, keyPoints] = match;
    
    // 计算考点数量来判断是否为重要句
    const keyPointCount = keyPoints.trim() === '无' ? 0 : 
      (keyPoints.match(/\d+、/g) || []).length;
    
    // 查询词典和考点获取上下文信息
    const contextData = await extractAndQueryKeyPoints(keyPoints.trim());
    
    sentences.push({
      sentence: sentence.trim(),
      translation: translation.trim(),
      annotation: annotation.trim(),
      keyPoints: keyPoints.trim(),
      isImportant: keyPointCount > 1,
      dictionaryContext: contextData.dictionaryContext.length > 0 ? contextData.dictionaryContext : undefined,
      kaodianContext: contextData.kaodianContext.length > 0 ? contextData.kaodianContext : undefined
    });
  }
  
  return sentences;
}

// 解析题目数据
function parseQuestions(text: string) {
  const questions = [];
  const questionPattern = /【考题(\d+)】([\s\S]*?)A\.([\s\S]*?)B\.([\s\S]*?)C\.([\s\S]*?)D\.([\s\S]*?)【答案\d+】([A-D])/g;
  
  let match;
  while ((match = questionPattern.exec(text)) !== null) {
    const [, num, question, optionA, optionB, optionC, optionD, answer] = match;
    
    questions.push({
      question: question.trim(),
      options: [
        optionA.trim(),
        optionB.trim(), 
        optionC.trim(),
        optionD.trim()
      ],
      answer: answer.trim()
    });
  }
  
  return questions;
}

// 解析考情分析
function parseExamAnalysis(text: string): string | undefined {
  const analysisPattern = /【考情分析】([\s\S]*?)(?=【|$)/;
  const match = text.match(analysisPattern);
  return match ? match[1].trim() : undefined;
}

// 从词典中查询字词
async function queryDictionary(word: string): Promise<{ word: string; explanation: string } | null> {
  try {
    // 使用文件系统路径读取词典文件
    const dictionaryPath = path.join(process.cwd(), 'public', 'data', 'dictionary.json');
    const dictionaryData = fs.readFileSync(dictionaryPath, 'utf8');
    const dictionary = JSON.parse(dictionaryData);
    
    const entry = dictionary.find((item: any) => item.字 === word);
    
    if (entry) {
      return {
        word: entry.字,
        explanation: entry.解释
      };
    }
    
    return null;
  } catch (error) {
    console.error('查询词典失败:', error);
    return null;
  }
}

// 从考点JSON中查询字词
async function queryKaodian(word: string): Promise<{ source: string; word: string; sentence: string; meaning: string } | null> {
  try {
    // 使用文件系统路径读取考点文件
    const kaodianPath = path.join(process.cwd(), 'public', 'data', 'kaodian.json');
    const kaodianData = fs.readFileSync(kaodianPath, 'utf8');
    const kaodian = JSON.parse(kaodianData);
    
    const entry = kaodian.find((item: any) => item.字词 === word);
    
    if (entry) {
      return {
        source: entry.来源,
        word: entry.字词,
        sentence: entry.对应句,
        meaning: entry.字义
      };
    }
    
    return null;
  } catch (error) {
    console.error('查询考点失败:', error);
    return null;
  }
}

// 从考点中提取待考字并查询词典和考点信息
async function extractAndQueryKeyPoints(keyPoints: string): Promise<{
  dictionaryContext: Array<{ word: string; explanation: string }>;
  kaodianContext: Array<{ source: string; word: string; sentence: string; meaning: string }>;
}> {
  const dictionaryContext: Array<{ word: string; explanation: string }> = [];
  const kaodianContext: Array<{ source: string; word: string; sentence: string; meaning: string }> = [];
  
  if (keyPoints === '无' || !keyPoints.trim()) {
    return { dictionaryContext, kaodianContext };
  }
  
  // 匹配格式：1、以：凭借；2、显：出名。
  const keyPointPattern = /\d+、([^：]+)：[^；]+/g;
  let match;
  
  while ((match = keyPointPattern.exec(keyPoints)) !== null) {
    const fullWord = match[1].trim();
    // 只取顿号后面的第一个字
    const word = fullWord.charAt(0);
    if (word) {
      // 查询词典
      const dictionaryEntry = await queryDictionary(word);
      if (dictionaryEntry) {
        dictionaryContext.push(dictionaryEntry);
        console.log(`找到词典条目: ${word} - ${dictionaryEntry.explanation.substring(0, 50)}...`);
      } else {
        console.log(`词典中未找到: ${word}`);
      }
      
      // 查询考点
      const kaodianEntry = await queryKaodian(word);
      if (kaodianEntry) {
        kaodianContext.push(kaodianEntry);
        console.log(`找到考点条目: ${word} - ${kaodianEntry.source}`);
      } else {
        console.log(`考点中未找到: ${word}`);
      }
    }
  }
  
  return { dictionaryContext, kaodianContext };
}

// 更新进度
async function updateProgress(scenarioId: string, progress: number, stage?: string) {
  const updateData: any = { progress };
  if (stage) {
    updateData.stage = stage;
  }
  
  await supabaseAdmin
    .from('learning_scenarios')
    .update(updateData)
    .eq('id', scenarioId);
  
  console.log(`[${scenarioId}] 进度更新: ${progress}% - ${stage || ''}`);
}

export async function POST(request: NextRequest) {
  let scenarioId: string | null = null;
  try {
    const body = await request.json();
    scenarioId = body.scenarioId;
    const { text } = body;

    if (!scenarioId || !text) {
      console.error('处理请求失败: 缺少 scenarioId 或 text');
      return NextResponse.json(
        { error: '缺少必要参数: scenarioId 和 text' },
        { status: 400 }
      );
    }

    console.log(`[${scenarioId}] 开始处理学习情境`);

    // 第一步：生成阅前指南、视频和图像提示词
    await updateProgress(scenarioId, 10, '正在生成阅读指南...');
    
    const prompt2 = `你擅长阅读文言文。请你根据以下文言文，以json结构生成{阅前指南}{视频}{图像}{诗句}。

{阅前指南}，是围绕这段文言文的一段简要的阅前指南，包括这篇文言文简要的时代背景（假设有的话）和内容概括（以一种比较引人入胜的话语）要求：简洁、不"剧透"过多原文细节。
{视频}请你帮我生成用于清影ai的【英文】提示词
要求：如果给到一整篇文言文，包含多个差异较大的画面内容，请选择最具有代表性的一个画面；尽量简洁精炼，篇幅短，一定不超过1000个字母（重要！！请反复确认）；视频内容要准确，不能误读文言文；画面涵盖重点细节；人物（假如有的话）眼神、动作自然流畅，不过度夸张；人物特征和人物关系符合原文（假如有的话）；符合古代背景下的逻辑；画面动态变化显著，有一定的运镜；有助于高中生感知文言文情境。手绘、漫画，Hand-drawn Chinese Anime Style, completely non-realistic. Close-up shot.
{图像}请你根据这个文言文内容，挑选一个和内容息息相关的某个【物件（或者任意形象）】，并且填空以下的[ITEM]，其他原样输出给我：A standalone pixel-art illustration of [ITEM], rendered in a highly stylized/exaggerated/whimsical/elegant (choose one) way. Crisp pixel detailing with randomized vibrant colors. No background, no text—pure isolated object with clear outlines. 1:1 aspect ratio.
{诗句}是围绕刚刚选择的【物件】，挑选出合适的【博物词汇】来表示这个物件（如，斑鸠，二-七个字都可以）。
注意，一定要遵循以上的指令。然后输出的例子要符合json格式。
{
"阅前指南": "xxx",
"视频": "xxx",
"图像": "xxx",
"诗句": "xxx"
}
不要再输出任何任何其他的话！！！以下是你的待处理文本：\n\n${text}`;

    let guideData;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`[${scenarioId}] 第${attempts + 1}次尝试调用ECNU API生成阅前指南...`);
        const guideResult = await callECNUPlus(prompt2);
        console.log(`[${scenarioId}] ECNU API响应内容:`, guideResult);
        
        if (validateFormat1(guideResult)) {
          // 使用相同的逻辑提取JSON内容
          let jsonText = guideResult.trim();
          if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
            jsonText = jsonText.slice(7, -3).trim();
          } else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
            jsonText = jsonText.slice(3, -3).trim();
          }
          try {
            guideData = JSON.parse(jsonText);
            console.log(`[${scenarioId}] 格式验证成功，解析后的数据:`, guideData);
            break;
          } catch (parseError) {
            console.log(`[${scenarioId}] JSON解析失败:`, parseError);
            console.log(`[${scenarioId}] 尝试解析的JSON文本:`, jsonText);
            throw parseError;
          }
        } else {
          console.log(`[${scenarioId}] 格式验证失败，第${attempts + 1}次尝试`);
          console.log(`[${scenarioId}] 验证失败的内容:`, guideResult);
        }
        attempts++;
      } catch (error) {
        console.log(`[${scenarioId}] 第${attempts + 1}次调用ECNU API出错:`, error);
        attempts++;
        if (attempts >= maxAttempts) throw error;
      }
    }

    if (!guideData) {
      console.log(`[${scenarioId}] 所有尝试都失败，生成阅前指南失败`);
      throw new Error('生成阅前指南失败');
    }

    await updateProgress(scenarioId, 25, '正在生成分句注释...');

    // 第二步：生成分句注释
    const prompt3 = `你是高中语文老师，请按照标点符号拆分句子（以句号、问号、感叹号为一句的单位），然后逐句处理以下文言文，拆分每句话【句n】，给出对应文言文句子的【翻译】【注解】【考点】。
【句n】以“。”、“！”、“？”，或者后引号为单位，逐句处理。
【翻译】1、请忠实原文直译，2、当且仅当省略主语、宾语或者状语（以/于，等）的时候，需要以括号表示出。
【注解】是该句中直接提供给学生阅读、不需要考察的、比较复杂的专业术语。一般是地理名词、文化典故等（并非是解释字词意思，而是如“庆父不死”这种比较难的典故术语）；
【考点】是该句中高中生来说需要掌握、被考察的字，仅仅包含以下几类：1、高考难度重要的实词、虚词（以单音字为主，直接按照以下例子，给出答案就好了，不要额外标注是什么词性）；2、通假字、词类活用需要额外标出。如果不存在的话，直接说“无”。

===注意：1、一定要忠实我给你的原文，不允许任何对原文的修改；
2、注意对象是高中生难度，只要关注最重要的字词就好了，如果一句话很简单，那么【注解】和【考点】都不需要标注，直接说“无”即可。
3、参考以下例子，按照例子的结构输出给我。不要再说任何任何的话了。
4、总之，务必保证你的思考简单、但是更重要的是，一定要保证答案准确。
===以下是一个示例。
你的输入待处理文本是："傅良弼，字安道，清河人也。以善弓矢显。"输出应该是：
【句1】傅良弼，字安道，清河人也。
【翻译】傅良弼，字安道，是清河地人。
【注解】1、清河：清河县，隶属河北省邢台市，古称青阳。
【考点】无

【句2】以善弓矢显。
【翻译】（傅良弼）凭借擅长射箭出名。
【注解】无
【考点】1、以：凭借；2、显：出名。

注意，注意，请你一定要严格按照示例结构输出，不要说任何多余的话。
\n\n${text}`;

    let sentenceResult;
    attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        sentenceResult = await callDeepSeekR1(prompt3, '你的待处理文本是：');
        if (validateFormat2(sentenceResult)) {
          break;
        }
        attempts++;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
      }
    }

    if (!sentenceResult) {
      throw new Error('生成分句注释失败');
    }

    await updateProgress(scenarioId, 40, '正在检查和修正内容...');

    // 第三步：检查和修正
    const prompt4 = `你是一名高中语文资深教研员，这是一名年轻老师写出的文言文逐句【注解】和【考点】，但是他总是比较难抓住关键、并且总是有一定可能会犯一些事实性的错误。我们要仅仅是1、删除那些并不重要的、高中生肯定已经知道的字词考点，保证【考点】的数量少于5个；并且2、修改那些可能会犯一些事实性的错误的地方（体现在一些典故、或者字词，如果你也拿不准的话，建议直接删去）。请你修改他的结果，给我修改后的，按照示例结构即可。其余的内容不用输出。也不需要在【考点】处加上括号解释。
例如：假设我的输入是：
【句1】傅良弼，字安道，清河人也。
【翻译】傅良弼，字安道，是清河地人。
【注解】1、清河：清河县，隶属河北省邢台市，古称青阳。
【考点】1、也：表示判断句的后缀。 
 你的输出为：【句1】傅良弼，字安道，清河人也。
【翻译】傅良弼，字安道，是清河地人。
【注解】1、清河：清河县，隶属河北省邢台市，古称青阳。
【考点】无       
**注意，不需要任何额外解释性的话!严格按照原本的结构输出。          
你的待处理文本是：
    \n\n${sentenceResult}`;

    let checkedResult;
    attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        checkedResult = await callDeepSeekR1(prompt4);
        if (validateFormat2(checkedResult)) {
          break;
        }
        attempts++;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) throw error;
      }
    }

    if (!checkedResult) {
      throw new Error('检查修正失败');
    }

    await updateProgress(scenarioId, 55, '正在生成练习题目...');

    // 解析句子数据（包含词典查询）
    const sentences = await parseSentences(checkedResult);
    
    // 第四步：为重要句生成题目
    const importantSentences = sentences.filter(s => s.isImportant);
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (sentence.isImportant) {
        // 更新题目生成进度
        const questionProgress = 55 + Math.floor(((i + 1) / importantSentences.length) * 15); // 题目生成占15%
        await updateProgress(scenarioId, questionProgress, `正在为重要句 ${i + 1}/${importantSentences.length} 生成题目...`);
        // 构建词典上下文信息
        let dictionaryContext = '';
        if (sentence.dictionaryContext && sentence.dictionaryContext.length > 0) {
          dictionaryContext = '\n\n【词典参考】\n' + 
            sentence.dictionaryContext.map(item => 
              `${item.word}：${item.explanation}`
            ).join('\n');
        }
        
        // 构建考点上下文信息
        let kaodianContext = '';
        if (sentence.kaodianContext && sentence.kaodianContext.length > 0) {
          kaodianContext = '\n\n【考情分析参考】\n' + 
            sentence.kaodianContext.map(item => 
              `${item.word}：${item.source} - ${item.sentence} - ${item.meaning}`
            ).join('\n');
        }
        
        const prompt5 = `你是一名高中语文老师，将下面句子，去除所有的标点符号后，生成"断句题"；根据考点，结合字典，生成"考题"（仅仅考察词语的意义）；根据是否有考情分析，最后生成"考情分析"（如无则没有这一部分。考情分析的内容完全是按照我给的数据来写的，有多少说多少，不准输出任何你不知道的事情！）。
        注意，1、个别字我会在下面给你字典的释义，你需要根据字典的释义将该字的其他意思，作为混淆项考察学生。
        2、如果该字往年曾经考察，请你写一份考情分析，如果没有的话，则不需要输出【考情分析】！严格根据我的输出，来写，不允许自己编造。
        严格按照结构输出，不要说任何多余的话：

假设你的待处理文本是：
【句2】以善弓矢显。
【翻译】（傅良弼）凭借擅长射箭出名。
【注解】无
【考点】1、以：凭借；2、显：出名。
那么你的输出是：
【句2】以善弓矢显。
【句2待句读】以善弓矢显
【翻译】（傅良弼）凭借擅长射箭出名。
【注解】无
【考题1】该句中，"以"的意思是？
A.凭借
B.说明
C.明天
D.天气
【答案1】A
【考题2】该句中，"显"的意思是？
A.出名
B.名气
C.知道
D.显现
【答案2】A
【考情分析】“以”字在近五年高考模考中，出现了10次，如2025年闵行区一模（以事谪戍辽东，怡然就道。），对应考察的字义包括“因为”“认为”等。
“显”字在近五年高考模考中，出现了3次，如2024年青浦区一模（先生宦久不显），对应考察的字义包括“显达“等。

==注意，出现了几次，具体的原文等，示例都是通过上下文填进去的！你的待处理文本、词典参考内容、考情分析（如有）是：

【句${i + 1}】${sentence.sentence}
【翻译】${sentence.translation}
【注解】${sentence.annotation}
【考点】${sentence.keyPoints}${dictionaryContext}${kaodianContext}`;

        try {
          const questionResult = await callECNUPlus(prompt5);
          if (validateFormat3(questionResult)) {
            // 提取句读题
            const punctuationMatch = questionResult.match(/【句\d+待句读】([\s\S]*?)【翻译】/);
            if (punctuationMatch) {
              sentence.punctuationExercise = punctuationMatch[1].trim();
            }
            
            // 提取题目
            sentence.questions = parseQuestions(questionResult);
            
            // 提取考情分析
            sentence.examAnalysis = parseExamAnalysis(questionResult);
          }
        } catch (error) {
          console.error(`生成第${i + 1}句题目失败:`, error);
        }
      }
    }

    await updateProgress(scenarioId, 70);

    // 第五步：生成图像
    await updateProgress(scenarioId, 80, '正在生成配图...');
    let imageUrl = '';
    try {
      const imageResponse = await fetch(`${GITEE_IMAGE_URL}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITEE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: guideData.图像,
          model: 'flux-1-schnell',
          size: '1024x1024',
          extra_body: {
            guidance_scale: 7.5,
            seed: 42
          }
        })
      });

      if (imageResponse.ok) {
        const imageResult = await imageResponse.json();
        console.log(`[${scenarioId}] 图片生成API响应:`, imageResult);
        
        // 处理base64图片数据
        if (imageResult.data?.[0]?.b64_json) {
          const base64Data = imageResult.data[0].b64_json;
          // 创建data URL格式的图片
          imageUrl = `data:image/jpeg;base64,${base64Data}`;
          console.log(`[${scenarioId}] 生成的图片数据长度:`, base64Data.length);
        } else if (imageResult.data?.[0]?.url) {
          imageUrl = imageResult.data[0].url;
          console.log(`[${scenarioId}] 提取的图片URL:`, imageUrl);
        } else {
          console.log(`[${scenarioId}] 未找到图片数据`);
        }
      } else {
        console.error(`[${scenarioId}] 图片生成API请求失败:`, imageResponse.status, imageResponse.statusText);
      }
    } catch (error) {
      console.error('生成图像失败:', error);
    }

    await updateProgress(scenarioId, 85, '正在生成视频...');

    // 第六步：生成视频
    let videoUrl = '';
    try {
      const videoResponse = await fetch(GITEE_VIDEO_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITEE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: guideData.视频,
          model: 'CogVideoX-5b',
          resolution: '720p',
          duration: 10
        })
      });

      if (videoResponse.ok) {
        const videoResult = await videoResponse.json();
        const taskId = videoResult.task_id;
        
        if (taskId) {
          // 轮询视频生成状态
          const statusUrl = `https://ai.gitee.com/v1/task/${taskId}`;
          let attempts = 0;
          const maxVideoAttempts = 40; // 最多等待5分钟
          
          while (attempts < maxVideoAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
            
            // 更新视频生成进度
            const videoProgress = 85 + Math.floor((attempts / maxVideoAttempts) * 10);
            await updateProgress(scenarioId, videoProgress, `正在生成视频... (${attempts + 1}/${maxVideoAttempts})`);
            
            try {
              const statusResponse = await fetch(statusUrl, {
                headers: {
                  'Authorization': `Bearer ${GITEE_API_KEY}`
                }
              });
              
              if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                console.log(`[${scenarioId}] 视频状态检查 (${attempts + 1}/${maxVideoAttempts}):`, statusResult);
                
                if (statusResult.status === 'success') {
                  videoUrl = statusResult.output?.file_url || '';
                  console.log(`[${scenarioId}] 视频生成成功: ${videoUrl}`);
                  break;
                } else if (statusResult.status === 'failed' || statusResult.status === 'cancelled') {
                  const failureReason = statusResult.output?.text || '无具体原因';
                  console.error(`[${scenarioId}] 视频生成任务失败或被取消。状态: ${statusResult.status}, 原因: ${failureReason}`);
                  throw new Error(`视频生成失败: ${failureReason}`);
                }
              }
            } catch (error) {
              console.error('检查视频状态失败:', error);
            }
            
            attempts++;
          }
        }
      }
    } catch (error) {
      console.error('生成视频失败:', error);
    }

    // 保存处理结果
    console.log(`[${scenarioId}] 准备保存到数据库 - imageUrl:`, imageUrl, 'videoUrl:', videoUrl);
    const { error: contentError } = await supabaseAdmin
      .from('scenario_content')
      .insert({
        scenario_id: scenarioId,
        reading_guide: guideData.阅前指南,
        video_prompt: guideData.视频,
        image_prompt: guideData.图像,
        video_url: videoUrl,
        image_url: imageUrl,
        sentences: sentences
      });
    
    console.log(`[${scenarioId}] 数据库保存结果 - contentError:`, contentError);

    if (contentError) {
      console.error(`[${scenarioId}] 保存处理结果到 scenario_content 失败:`, contentError);
      throw contentError;
    }

    // 更新状态为完成，并保存诗句
    await supabaseAdmin
      .from('learning_scenarios')
      .update({ 
        status: 'ready',
        progress: 100,
        stage: '处理完成！',
        poem: guideData.诗句
      })
      .eq('id', scenarioId);

    console.log(`[${scenarioId}] 学习情境处理完成`);

    return NextResponse.json({
      success: true,
      message: '处理完成'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`[${scenarioId || '未知ID'}] 处理学习情境失败:`, errorMessage);
    
    if (scenarioId) {
      try {
        await supabaseAdmin
          .from('learning_scenarios')
          .update({ 
            status: 'failed', 
            progress: 0,
            stage: '处理失败',
            error_message: `处理失败: ${errorMessage}`
          })
          .eq('id', scenarioId);
        console.log(`[${scenarioId}] 已将情境状态更新为 'failed'`);
      } catch (updateError) {
        console.error(`[${scenarioId}] 更新失败状态时出错:`, updateError);
      }
    }

    // 返回详细错误信息
    const errorDetails = {
      error: errorMessage,
      timestamp: new Date().toISOString(),
      suggestion: '请检查网络连接后重试，或联系技术支持'
    };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}