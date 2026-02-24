import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const config = await getConfig();
  const result = {
    SiteName: config.SiteConfig.SiteName,
    SiteIcon: config.SiteConfig.SiteIcon || '',
    StorageType: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    Version: CURRENT_VERSION,
    OpenRegister: !!config.UserConfig.OpenRegister,
  };
  return NextResponse.json(result);
}
