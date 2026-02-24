import { NextRequest, NextResponse } from 'next/server';

import { isGuardFailure, requireActiveUser } from '@/lib/api-auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  // 不支持 localstorage 模式
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储模式修改密码',
      },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const { oldPassword, newPassword } = body;

    const guardResult = await requireActiveUser(request);
    if (isGuardFailure(guardResult)) return guardResult.response;

    // 验证旧密码
    if (!oldPassword || typeof oldPassword !== 'string') {
      return NextResponse.json({ error: '请输入当前密码' }, { status: 400 });
    }

    // 验证新密码
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '新密码不得为空' }, { status: 400 });
    }

    const username = guardResult.username;

    // 不允许站长修改密码
    if (guardResult.isOwner) {
      return NextResponse.json(
        { error: '站长不能通过此接口修改密码' },
        { status: 403 },
      );
    }

    // 验证旧密码是否正确
    const isOldPasswordValid = await db.verifyUser(username, oldPassword);
    if (!isOldPasswordValid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 401 });
    }

    // 修改密码
    await db.changePassword(username, newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('修改密码失败:', error);
    return NextResponse.json(
      {
        error: '修改密码失败',
      },
      { status: 500 },
    );
  }
}
