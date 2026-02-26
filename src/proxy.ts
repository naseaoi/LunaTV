import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie, verifySignature } from '@/lib/auth';
import { getOwnerPassword } from '@/lib/env.server';

function isSessionExpired(expiresAt?: number): boolean {
  return !expiresAt || Date.now() > expiresAt;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 跳过不需要认证的路径
  if (shouldSkipAuth(pathname)) {
    return NextResponse.next();
  }

  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  const ownerPassword = getOwnerPassword();

  if (!ownerPassword) {
    // 如果没有设置密码，重定向到警告页面
    const warningUrl = new URL('/warning', request.url);
    return NextResponse.redirect(warningUrl);
  }

  // 从cookie获取认证信息
  const authInfo = getAuthInfoFromCookie(request);

  if (!authInfo) {
    return handleAuthFailure(request, pathname);
  }

  // localstorage模式：在proxy中完成验证
  if (storageType === 'localstorage') {
    if (
      authInfo.sessionType !== 'localstorage' ||
      !authInfo.signature ||
      isSessionExpired(authInfo.expiresAt)
    ) {
      return handleAuthFailure(request, pathname);
    }

    const isValidLocalSignature = await verifySignature(
      `localstorage:${authInfo.expiresAt}`,
      authInfo.signature,
      ownerPassword,
    );

    if (!isValidLocalSignature) {
      return handleAuthFailure(request, pathname);
    }

    return NextResponse.next();
  }

  // 其他模式：只验证签名
  // 检查是否有用户名（非localStorage模式下密码不存储在cookie中）
  if (!authInfo.username || !authInfo.signature) {
    return handleAuthFailure(request, pathname);
  }

  // 验证签名（如果存在）
  if (authInfo.signature) {
    if (isSessionExpired(authInfo.expiresAt)) {
      return handleAuthFailure(request, pathname);
    }

    const isValidSignature = await verifySignature(
      `${authInfo.username}:${authInfo.expiresAt}`,
      authInfo.signature,
      ownerPassword,
    );

    // 签名验证通过即可
    if (isValidSignature) {
      return NextResponse.next();
    }
  }

  // 签名验证失败或不存在签名
  return handleAuthFailure(request, pathname);
}

// 处理认证失败的情况
function handleAuthFailure(
  request: NextRequest,
  pathname: string,
): NextResponse {
  // 如果是 API 路由，返回 401 状态码
  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 },
    );
  }

  // 否则重定向到登录页面
  const loginUrl = new URL('/login', request.url);
  // 保留完整的URL，包括查询参数
  const fullUrl = `${pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('redirect', fullUrl);
  return NextResponse.redirect(loginUrl);
}

// 模块级常量，避免每次请求重建数组
const SKIP_PATHS = [
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.json',
  '/icons/',
  '/logo.png',
  '/screenshot.png',
];

// 判断是否需要跳过认证的路径
function shouldSkipAuth(pathname: string): boolean {
  return SKIP_PATHS.some((path) => pathname.startsWith(path));
}

// 配置proxy匹配规则
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|warning|api/login|api/register|api/logout|api/cron|api/server-config|api/version/latest).*)',
  ],
};
