import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

/** 返回源站流量路由映射：{ [sourceKey]: 'server' | 'browser' } */
export async function GET() {
  try {
    const config = await getConfig();
    const modes: Record<string, string> = {};
    for (const s of config.SourceConfig) {
      if (s.proxyMode) {
        modes[s.key] = s.proxyMode;
      }
    }
    return NextResponse.json(modes, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
