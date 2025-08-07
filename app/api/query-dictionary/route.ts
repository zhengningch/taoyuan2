import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json();
    
    if (!word) {
      return NextResponse.json({ error: '缺少查询词汇' }, { status: 400 });
    }

    // 查询词典
    const dictionaryPath = path.join(process.cwd(), 'public', 'data', 'dictionary.json');
    const dictionaryData = fs.readFileSync(dictionaryPath, 'utf8');
    const dictionary = JSON.parse(dictionaryData);
    
    const entry = dictionary.find((item: any) => item.字 === word);
    
    if (entry) {
      return NextResponse.json({
        word: entry.字,
        explanation: entry.解释
      });
    }
    
    // 如果词典中没有，尝试查询考点数据
    const kaodianPath = path.join(process.cwd(), 'public', 'data', 'kaodian.json');
    const kaodianData = fs.readFileSync(kaodianPath, 'utf8');
    const kaodian = JSON.parse(kaodianData);
    
    const kaodianEntry = kaodian.find((item: any) => item.字词 === word);
    
    if (kaodianEntry) {
      return NextResponse.json({
        word: kaodianEntry.字词,
        explanation: kaodianEntry.字义,
        source: kaodianEntry.来源,
        sentence: kaodianEntry.对应句
      });
    }
    
    return NextResponse.json({ error: '未找到词条' }, { status: 404 });
  } catch (error) {
    console.error('查询词典失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}