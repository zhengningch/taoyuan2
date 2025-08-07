import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建一个服务端客户端，绕过 RLS
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

export async function POST(request: NextRequest) {
  try {
    const { userId, petType, scenarioId } = await request.json();
    console.log('抽取皮肤API调用:', { userId, petType, scenarioId });

    if (!userId || !petType || !scenarioId) {
      console.log('缺少必要参数:', { userId, petType, scenarioId });
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查学习进度是否完成
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from('learning_progress')
      .select('is_completed, skin_drawn')
      .eq('user_id', userId)
      .eq('scenario_id', scenarioId)
      .single();

    console.log('学习进度查询结果:', { progressData, progressError });

    if (progressError) {
      console.log('查询学习进度失败:', progressError);
      return NextResponse.json(
        { error: '查询学习进度失败' },
        { status: 500 }
      );
    }

    if (!progressData.is_completed) {
      console.log('学习未完成，无法抽取皮肤');
      return NextResponse.json(
        { success: false, message: '请先完成学习再抽取皮肤' },
        { status: 200 }
      );
    }

    if (progressData.skin_drawn) {
      console.log('已经抽取过皮肤');
      return NextResponse.json(
        { success: false, message: '该学习卡片已经抽取过皮肤了' },
        { status: 200 }
      );
    }

    // 测试模式：100%中奖概率
    // 正常模式应该是：1-4号皮肤50%概率，5-8号皮肤30%概率，20%概率不中
    const random = Math.random();
    let skinNumber: number | null = null;

    // 测试模式：100%中奖
   //if (random < 0.5) {
      // 50% 概率抽中 1-4
      //skinNumber = Math.floor(Math.random() * 4) + 1;
   // } else {
      // 50% 概率抽中 5-8
   //   skinNumber = Math.floor(Math.random() * 4) + 5;
   // }
    
    //console.log('抽取结果:', { random, skinNumber });
    
    // 正常模式的代码（注释掉）：
    // if (random < 0.5) {
    //   // 50% 概率抽中 1-4
    //   skinNumber = Math.floor(Math.random() * 4) + 1;
    // } else if (random < 0.8) {
    //   // 30% 概率抽中 5-8
    //   skinNumber = Math.floor(Math.random() * 4) + 5;
    // }
    // // 20% 概率不中 (skinNumber 保持 null)


  if (random < 0.20) {
  // 20% 概率抽中 1-4号皮肤（稀有）
    skinNumber = Math.floor(Math.random() * 4) + 1;
  } else if (random < 0.30) {
  // 10% 概率抽中 5-6号皮肤（传说）
    skinNumber = Math.floor(Math.random() * 2) + 5;
  } else if (random < 0.35) {
  // 5% 概率抽中 7号皮肤（史诗）
    skinNumber = 7;
  } else if (random < 0.36) {
  // 1% 概率抽中 8号皮肤（无双）
    skinNumber = 8;
  }
  // 64% 概率不中奖


    if (skinNumber) {
      console.log('开始检查是否已拥有皮肤:', { userId, petType, skinNumber });
      // 检查是否已经拥有这个皮肤
      const { data: existingSkin, error: checkError } = await supabaseAdmin
        .from('unlocked_skins')
        .select('id')
        .eq('user_id', userId)
        .eq('pet_type', petType)
        .eq('skin_number', skinNumber)
        .single();
        
      console.log('检查结果:', { existingSkin, checkError });

      if (existingSkin) {
        // 如果已经拥有，返回失败
        return NextResponse.json({
          success: false,
          message: '已经拥有这个皮肤了！'
        });
      }

      // 添加到数据库
      console.log('准备插入新皮肤:', { user_id: userId, pet_type: petType, skin_number: skinNumber });
      const { data: insertData, error } = await supabaseAdmin
        .from('unlocked_skins')
        .insert({
          user_id: userId,
          pet_type: petType,
          skin_number: skinNumber
        })
        .select();

      console.log('插入结果:', { insertData, error });
      
      if (error) {
        console.error('保存皮肤失败:', error);
        return NextResponse.json(
          { error: '保存皮肤失败' },
          { status: 500 }
        );
      }

      // 更新学习进度，标记已抽取皮肤
      const { error: updateError } = await supabaseAdmin
        .from('learning_progress')
        .update({ skin_drawn: true })
        .eq('user_id', userId)
        .eq('scenario_id', scenarioId);

      if (updateError) {
        console.error('更新抽取状态失败:', updateError);
        // 这里不返回错误，因为皮肤已经成功添加
      }

      return NextResponse.json({
        success: true,
        skinNumber
      });
    } else {
      // 没有抽中，也要标记已抽取皮肤
      const { error: updateError } = await supabaseAdmin
        .from('learning_progress')
        .update({ skin_drawn: true })
        .eq('user_id', userId)
        .eq('scenario_id', scenarioId);

      if (updateError) {
        console.error('更新抽取状态失败:', updateError);
      }

      return NextResponse.json({
        success: false,
        message: '很遗憾，再学习一次吧！'
      });
    }
  } catch (error) {
    console.error('抽取皮肤API错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}