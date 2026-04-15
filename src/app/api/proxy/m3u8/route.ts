import { NextResponse } from 'next/server';

import { getBaseUrl, resolveUrl } from '@/lib/live';
import { validateProxyUrl } from '@/lib/url-guard';

import { getProxySourceKey, resolveProxyUserAgent } from '../utils';

export const runtime = 'nodejs';

// ================================================================
// VOD M3U8 清单缓存（减少重复请求上游源站）
// ================================================================

type M3U8CacheEntry = {
  content: string;
  contentType: string;
  finalUrl: string;
  timestamp: number;
};

const m3u8Cache = new Map<string, M3U8CacheEntry>();
const M3U8_CACHE_TTL_MS = 60_000;
const M3U8_CACHE_MAX_SIZE = 200;

function getM3U8Cache(url: string): M3U8CacheEntry | null {
  const entry = m3u8Cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > M3U8_CACHE_TTL_MS) {
    m3u8Cache.delete(url);
    return null;
  }
  // LRU：命中时刷新位置
  m3u8Cache.delete(url);
  m3u8Cache.set(url, entry);
  return entry;
}

function setM3U8Cache(
  url: string,
  content: string,
  contentType: string,
  finalUrl: string,
): void {
  if (m3u8Cache.size >= M3U8_CACHE_MAX_SIZE) {
    const firstKey = m3u8Cache.keys().next().value;
    if (firstKey) m3u8Cache.delete(firstKey);
  }
  m3u8Cache.set(url, {
    content,
    contentType,
    finalUrl,
    timestamp: Date.now(),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const allowCORS = searchParams.get('allowCORS') === 'true';
  const source = getProxySourceKey(searchParams);
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const validation = validateProxyUrl(url);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 403 });
  }

  const ua = await resolveProxyUserAgent(source);

  try {
    // 查询 VOD 清单缓存（避免重复请求上游源站）
    const cached = getM3U8Cache(validation.url);
    if (cached) {
      const baseUrl = getBaseUrl(cached.finalUrl);
      const modifiedContent = rewriteM3U8Content(
        cached.content,
        baseUrl,
        request,
        allowCORS,
        source,
      );

      const headers = new Headers();
      headers.set('Content-Type', cached.contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Range, Origin, Accept',
      );
      headers.set('Cache-Control', 'no-cache');
      headers.set(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range',
      );
      return new Response(modifiedContent, { status: 200, headers });
    }

    const response = await fetch(validation.url, {
      cache: 'no-cache',
      redirect: 'follow',
      credentials: 'same-origin',
      headers: {
        'User-Agent': ua,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch m3u8' },
        { status: 500 },
      );
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('octet-stream')
    ) {
      const finalUrl = response.url;
      const m3u8Content = await response.text();
      const baseUrl = getBaseUrl(finalUrl);

      // VOD / Master playlist 写入缓存（直播清单不缓存）
      if (
        m3u8Content.includes('#EXT-X-ENDLIST') ||
        m3u8Content.includes('#EXT-X-STREAM-INF')
      ) {
        setM3U8Cache(validation.url, m3u8Content, contentType, finalUrl);
      }

      const modifiedContent = rewriteM3U8Content(
        m3u8Content,
        baseUrl,
        request,
        allowCORS,
        source,
      );

      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Range, Origin, Accept',
      );
      headers.set('Cache-Control', 'no-cache');
      headers.set(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range',
      );
      return new Response(modifiedContent, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    const headers = new Headers();
    headers.set(
      'Content-Type',
      response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, Origin, Accept',
    );
    headers.set('Cache-Control', 'no-cache');
    headers.set(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range',
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch m3u8' },
      { status: 500 },
    );
  }
}

function rewriteM3U8Content(
  content: string,
  baseUrl: string,
  req: Request,
  allowCORS: boolean,
  source: string | null,
) {
  const referer = req.headers.get('referer');
  let protocol = 'http';
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      protocol = refererUrl.protocol.replace(':', '');
    } catch (error) {
      // ignore
    }
  }

  const host = req.headers.get('host');
  const proxyBase = `${protocol}://${host}/api/proxy`;

  const lines = content.split('\n');
  const rewrittenLines: string[] = [];

  const buildProxyPath = (
    path: 'segment' | 'm3u8' | 'key',
    targetUrl: string,
    extra: Record<string, string> = {},
  ) => {
    const params = new URLSearchParams({
      url: targetUrl,
      ...extra,
    });
    if (source) {
      params.set('icetv-source', source);
    }
    return `${proxyBase}/${path}?${params.toString()}`;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line && !line.startsWith('#')) {
      const resolvedUrl = resolveUrl(baseUrl, line);
      const proxyUrl = allowCORS
        ? resolvedUrl
        : buildProxyPath('segment', resolvedUrl);
      rewrittenLines.push(proxyUrl);
      continue;
    }

    if (line.startsWith('#EXT-X-MAP:')) {
      line = rewriteMapUri(line, baseUrl, proxyBase, source);
    }

    if (line.startsWith('#EXT-X-KEY:')) {
      line = rewriteKeyUri(line, baseUrl, proxyBase, source);
    }

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      rewrittenLines.push(line);
      if (i + 1 < lines.length) {
        i++;
        const nextLine = lines[i].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          const resolvedUrl = resolveUrl(baseUrl, nextLine);
          const proxyUrl = buildProxyPath('m3u8', resolvedUrl);
          rewrittenLines.push(proxyUrl);
        } else {
          rewrittenLines.push(nextLine);
        }
      }
      continue;
    }

    rewrittenLines.push(line);
  }

  return rewrittenLines.join('\n');
}

function rewriteMapUri(
  line: string,
  baseUrl: string,
  proxyBase: string,
  source: string | null,
) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const params = new URLSearchParams({ url: resolvedUrl });
    if (source) {
      params.set('icetv-source', source);
    }
    const proxyUrl = `${proxyBase}/segment?${params.toString()}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}

function rewriteKeyUri(
  line: string,
  baseUrl: string,
  proxyBase: string,
  source: string | null,
) {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (uriMatch) {
    const originalUri = uriMatch[1];
    const resolvedUrl = resolveUrl(baseUrl, originalUri);
    const params = new URLSearchParams({ url: resolvedUrl });
    if (source) {
      params.set('icetv-source', source);
    }
    const proxyUrl = `${proxyBase}/key?${params.toString()}`;
    return line.replace(uriMatch[0], `URI="${proxyUrl}"`);
  }
  return line;
}
