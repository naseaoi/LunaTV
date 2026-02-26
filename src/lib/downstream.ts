import { API_CONFIG, ApiSite, getConfig } from '@/lib/config';
import { getCachedSearchPage, setCachedSearchPage } from '@/lib/search-cache';
import { SearchResult } from '@/lib/types';
import { cleanHtmlTags } from '@/lib/utils';

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

interface GirigiriSuggestItem {
  id: number | string;
  name: string;
  pic?: string;
}

interface GirigiriPlayExtractResult {
  url: string | null;
  title: string;
  year: string;
  desc: string;
  poster: string;
}

function isGirigiriSource(apiSite: ApiSite): boolean {
  return /girigirilove\.com/i.test(apiSite.api);
}

// giri 页面请求用浏览器风格 headers，降低 CF 盾触发概率
const GIRI_HTML_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/** 检测 HTML 是否为 Cloudflare challenge 页面 */
function isCfChallenge(html: string): boolean {
  return (
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_opt') ||
    html.includes('challenge-platform') ||
    (html.includes('Just a moment') && html.includes('cloudflare'))
  );
}

/** giri 页面 fetch，遇到 CF challenge 自动重试一次 */
async function fetchGiriHtml(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: GIRI_HTML_HEADERS });
      if (!res.ok) return null;
      const html = await res.text();
      if (!isCfChallenge(html)) return html;
      // CF challenge，等 1.5 秒后重试
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    } catch {
      return null;
    }
  }
  return null;
}

function getSiteOrigin(apiSite: ApiSite): string {
  const fallback = apiSite.api.replace(/\/+$/, '');
  try {
    return new URL(apiSite.api).origin;
  } catch {
    return fallback;
  }
}

function toAbsoluteUrl(url: string, origin: string): string {
  if (!url) return '';
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

function decodeGirigiriPlayUrl(rawUrl: string, encrypt: number): string {
  const normalized = rawUrl.replace(/\\\//g, '/');

  if (encrypt === 2) {
    try {
      const base64Decoded = Buffer.from(normalized, 'base64').toString('utf8');
      return decodeURIComponent(base64Decoded);
    } catch {
      return normalized;
    }
  }

  if (encrypt === 1) {
    try {
      return decodeURIComponent(normalized);
    } catch {
      return normalized;
    }
  }

  return normalized;
}

async function fetchGirigiriEpisodePlayUrl(
  origin: string,
  playPath: string,
): Promise<GirigiriPlayExtractResult> {
  const playUrl = toAbsoluteUrl(playPath, origin);
  const html = await fetchGiriHtml(playUrl);

  if (!html) {
    return {
      url: null,
      title: '',
      year: 'unknown',
      desc: '',
      poster: '',
    };
  }

  const title =
    html.match(/class="player-title-link"[^>]*>([^<]+)<\/a>/)?.[1]?.trim() ||
    html.match(/<title>([^<_]+)/)?.[1]?.trim() ||
    '';
  const desc =
    cleanHtmlTags(
      html.match(/<div class="small-text">([\s\S]*?)<\/div>/)?.[1] ||
        html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ||
        '',
    ).trim() || '';
  const year =
    html.match(/<div class="cor4"\s+title="(\d{4})">/)?.[1] ||
    html.match(/<a[^>]*>(\d{4})<\/a>/)?.[1] ||
    'unknown';
  const poster = toAbsoluteUrl(
    html.match(/<div class="this-pic">[\s\S]*?data-src="([^"]+)"/i)?.[1] ||
      html.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
      '',
    origin,
  );

  const playerBlock =
    html.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\});/)?.[1] || '';
  const encryptMatch = playerBlock.match(/"encrypt":(\d+)/);
  const urlMatch = playerBlock.match(/"url":"([^"]+)"/);
  if (!urlMatch) {
    return {
      url: null,
      title,
      year,
      desc,
      poster,
    };
  }

  const encrypt = encryptMatch ? Number(encryptMatch[1]) : 0;
  const decoded = decodeGirigiriPlayUrl(urlMatch[1], encrypt);
  const normalizedUrl = /^https?:\/\//i.test(decoded)
    ? decoded
    : decoded.startsWith('//')
      ? `https:${decoded}`
      : '';

  return {
    url: normalizedUrl || null,
    title,
    year,
    desc,
    poster,
  };
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

async function searchFromGirigiri(
  apiSite: ApiSite,
  query: string,
): Promise<SearchResult[]> {
  const origin = getSiteOrigin(apiSite);
  const searchUrl = `${origin}/index.php/ajax/suggest?mid=1&wd=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(searchUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];
    const data = await response.json();
    const list = Array.isArray(data?.list)
      ? (data.list as GirigiriSuggestItem[])
      : [];

    return list
      .map((item) => {
        const id = String(item.id || '').trim();
        const title = (item.name || '').trim();
        if (!id || !title) return null;

        return {
          id,
          title,
          poster: toAbsoluteUrl(item.pic || '', origin),
          episodes: [],
          episodes_titles: [],
          source: apiSite.key,
          source_name: apiSite.name,
          class: '',
          year: 'unknown',
          desc: '',
          type_name: '',
          douban_id: 0,
        } as SearchResult;
      })
      .filter((item): item is SearchResult => Boolean(item));
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

async function getDetailFromGirigiri(
  apiSite: ApiSite,
  id: string,
): Promise<SearchResult> {
  const origin = getSiteOrigin(apiSite);
  const detailUrl = `${origin}/GV${id}/`;
  const html = await fetchGiriHtml(detailUrl);

  if (!html) {
    throw new Error('详情页请求失败或被 Cloudflare 拦截');
  }

  const title =
    html
      .match(/<h3 class="slide-info-title[^"]*">([^<]+)<\/h3>/)?.[1]
      ?.trim() ||
    html.match(/<title>([^<_]+)/)?.[1]?.trim() ||
    '';
  const descRaw =
    html.match(/id="height_limit"[^>]*>([\s\S]*?)<\/div>/)?.[1] ||
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ||
    '';
  const desc = cleanHtmlTags(descRaw).trim();
  const year =
    html.match(/<em class="cor4">年份：<\/em>\s*(\d{4})/)?.[1] ||
    html.match(/href="\/search\/[^"]*?(\d{4})\/"/)?.[1] ||
    html.match(/<a[^>]*>(\d{4})<\/a>/)?.[1] ||
    'unknown';
  const posterRaw =
    html.match(/<div class="detail-pic">[\s\S]*?data-src="([^"]+)"/i)?.[1] ||
    html.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
    '';
  const poster = toAbsoluteUrl(posterRaw, origin);

  const episodeMap = new Map<string, string>();
  const episodeRegex = /href="(\/playGV\d+-\d+-\d+\/)"[^>]*>([\s\S]*?)<\/a>/g;
  const episodeMatches = Array.from(html.matchAll(episodeRegex));
  for (const match of episodeMatches) {
    const playPath = match[1];
    const epTitle =
      cleanHtmlTags(match[2] || '').trim() || `${episodeMap.size + 1}`;
    if (!episodeMap.has(playPath)) {
      episodeMap.set(playPath, epTitle);
    }
  }

  const episodeEntries = Array.from(episodeMap.entries());
  if (episodeEntries.length === 0) {
    throw new Error('详情页未提取到可播放剧集');
  }

  const playResults = await runWithConcurrency(
    episodeEntries.map(
      ([playPath]) =>
        async () =>
          fetchGirigiriEpisodePlayUrl(origin, playPath),
    ),
    4,
  );

  const episodes: string[] = [];
  const episodesTitles: string[] = [];
  playResults.forEach((result, index) => {
    if (result.url) {
      episodes.push(result.url);
      episodesTitles.push(episodeEntries[index][1]);
    }
  });

  const fallbackMeta = playResults.find(
    (item) => item.title || item.poster || item.desc || item.year !== 'unknown',
  );

  const finalTitle = title || fallbackMeta?.title || '';
  const finalPoster = poster || fallbackMeta?.poster || '';
  const finalYear = year !== 'unknown' ? year : fallbackMeta?.year || 'unknown';
  const finalDesc = desc || fallbackMeta?.desc || '';

  if (episodes.length === 0) {
    throw new Error('未提取到有效播放地址');
  }

  return {
    id,
    title: finalTitle,
    poster: finalPoster,
    episodes,
    episodes_titles: episodesTitles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: '',
    year: finalYear,
    desc: finalDesc,
    type_name: '',
    douban_id: 0,
  };
}

/**
 * 从 vod_play_url 中解析出 m3u8 播放链接和对应标题。
 * 格式: 多播放源用 $$$ 分隔，每个源内集与集之间用 # 分隔，标题与链接用 $ 分隔。
 * 取集数最多的播放源。
 */
function parseVodPlayUrl(vodPlayUrl: string): {
  episodes: string[];
  titles: string[];
} {
  let episodes: string[] = [];
  let titles: string[] = [];

  const sources = vodPlayUrl.split('$$$');
  for (const source of sources) {
    const matchEpisodes: string[] = [];
    const matchTitles: string[] = [];
    const pairs = source.split('#');
    for (const pair of pairs) {
      const parts = pair.split('$');
      if (parts.length === 2 && parts[1].endsWith('.m3u8')) {
        matchTitles.push(parts[0]);
        matchEpisodes.push(parts[1]);
      }
    }
    if (matchEpisodes.length > episodes.length) {
      episodes = matchEpisodes;
      titles = matchTitles;
    }
  }

  return { episodes, titles };
}

/**
 * 通用的带缓存搜索函数
 */
async function searchWithCache(
  apiSite: ApiSite,
  query: string,
  page: number,
  url: string,
  timeoutMs = 8000,
): Promise<{ results: SearchResult[]; pageCount?: number }> {
  // 先查缓存
  const cached = getCachedSearchPage(apiSite.key, query, page);
  if (cached) {
    if (cached.status === 'ok') {
      return { results: cached.data, pageCount: cached.pageCount };
    } else {
      return { results: [] };
    }
  }

  // 缓存未命中，发起网络请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 403) {
        setCachedSearchPage(apiSite.key, query, page, 'forbidden', []);
      }
      return { results: [] };
    }

    const data = await response.json();
    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      // 空结果不做负缓存要求，这里不写入缓存
      return { results: [] };
    }

    // 处理结果数据
    const allResults = data.list.map((item: ApiSearchItem) => {
      const { episodes, titles } = item.vod_play_url
        ? parseVodPlayUrl(item.vod_play_url)
        : { episodes: [], titles: [] };

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        episodes_titles: titles,
        source: apiSite.key,
        source_name: apiSite.name,
        class: item.vod_class,
        year: item.vod_year
          ? item.vod_year.match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name,
        douban_id: item.vod_douban_id,
      };
    });

    // 过滤掉集数为 0 的结果
    const results = allResults.filter(
      (result: SearchResult) => result.episodes.length > 0,
    );

    const pageCount = page === 1 ? data.pagecount || 1 : undefined;
    // 写入缓存（成功）
    setCachedSearchPage(apiSite.key, query, page, 'ok', results, pageCount);
    return { results, pageCount };
  } catch (error: any) {
    clearTimeout(timeoutId);
    // 识别被 AbortController 中止（超时）
    const aborted =
      error?.name === 'AbortError' ||
      error?.code === 20 ||
      error?.message?.includes('aborted');
    if (aborted) {
      setCachedSearchPage(apiSite.key, query, page, 'timeout', []);
    }
    return { results: [] };
  }
}

export async function searchFromApi(
  apiSite: ApiSite,
  query: string,
): Promise<SearchResult[]> {
  if (isGirigiriSource(apiSite)) {
    return searchFromGirigiri(apiSite, query);
  }

  try {
    const apiBaseUrl = apiSite.api;
    const apiUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);

    // 使用新的缓存搜索函数处理第一页
    const firstPageResult = await searchWithCache(
      apiSite,
      query,
      1,
      apiUrl,
      8000,
    );
    const results = firstPageResult.results;
    const pageCountFromFirst = firstPageResult.pageCount;

    const config = await getConfig();
    const MAX_SEARCH_PAGES: number = config.SiteConfig.SearchDownstreamMaxPage;

    // 获取总页数
    const pageCount = pageCountFromFirst || 1;
    // 确定需要获取的额外页数
    const pagesToFetch = Math.min(pageCount - 1, MAX_SEARCH_PAGES - 1);

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', page.toString());

        const pagePromise = (async () => {
          // 使用新的缓存搜索函数处理分页
          const pageResult = await searchWithCache(
            apiSite,
            query,
            page,
            pageUrl,
            8000,
          );
          return pageResult.results;
        })();

        additionalPagePromises.push(pagePromise);
      }

      // 等待所有额外页的结果
      const additionalResults = await Promise.all(additionalPagePromises);

      // 合并所有页的结果
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    return results;
  } catch (error) {
    return [];
  }
}

// 匹配 m3u8 链接的正则
const M3U8_PATTERN = /(https?:\/\/[^"'\s]+?\.m3u8)/g;

export async function getDetailFromApi(
  apiSite: ApiSite,
  id: string,
): Promise<SearchResult> {
  if (isGirigiriSource(apiSite)) {
    return getDetailFromGirigiri(apiSite, id);
  }

  if (apiSite.detail) {
    return handleSpecialSourceDetail(id, apiSite);
  }

  const detailUrl = `${apiSite.api}${API_CONFIG.detail.path}${id}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情请求失败: ${response.status}`);
  }

  const data = await response.json();

  if (
    !data ||
    !data.list ||
    !Array.isArray(data.list) ||
    data.list.length === 0
  ) {
    throw new Error('获取到的详情内容无效');
  }

  const videoDetail = data.list[0];
  const { episodes: parsedEpisodes, titles } = videoDetail.vod_play_url
    ? parseVodPlayUrl(videoDetail.vod_play_url)
    : { episodes: [], titles: [] };
  let episodes = parsedEpisodes;

  // 如果播放源为空，则尝试从内容中解析 m3u8
  if (episodes.length === 0 && videoDetail.vod_content) {
    const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
    episodes = matches.map((link: string) => link.replace(/^\$/, ''));
  }

  return {
    id: id.toString(),
    title: videoDetail.vod_name,
    poster: videoDetail.vod_pic,
    episodes,
    episodes_titles: titles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: videoDetail.vod_class,
    year: videoDetail.vod_year
      ? videoDetail.vod_year.match(/\d{4}/)?.[0] || ''
      : 'unknown',
    desc: cleanHtmlTags(videoDetail.vod_content),
    type_name: videoDetail.type_name,
    douban_id: videoDetail.vod_douban_id,
  };
}

async function handleSpecialSourceDetail(
  id: string,
  apiSite: ApiSite,
): Promise<SearchResult> {
  const detailUrl = `${apiSite.detail}/index.php/vod/detail/id/${id}.html`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(detailUrl, {
    headers: API_CONFIG.detail.headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`详情页请求失败: ${response.status}`);
  }

  const html = await response.text();
  let matches: string[] = [];

  if (apiSite.key === 'ffzy') {
    const ffzyPattern =
      /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
    matches = html.match(ffzyPattern) || [];
  }

  if (matches.length === 0) {
    const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
    matches = html.match(generalPattern) || [];
  }

  // 去重并清理链接前缀
  matches = Array.from(new Set(matches)).map((link: string) => {
    link = link.substring(1); // 去掉开头的 $
    const parenIndex = link.indexOf('(');
    return parenIndex > 0 ? link.substring(0, parenIndex) : link;
  });

  // 根据 matches 数量生成剧集标题
  const episodes_titles = Array.from({ length: matches.length }, (_, i) =>
    (i + 1).toString(),
  );

  // 提取标题
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const titleText = titleMatch ? titleMatch[1].trim() : '';

  // 提取描述
  const descMatch = html.match(
    /<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/,
  );
  const descText = descMatch ? cleanHtmlTags(descMatch[1]) : '';

  // 提取封面
  const coverMatch = html.match(/(https?:\/\/[^"'\s]+?\.jpg)/g);
  const coverUrl = coverMatch ? coverMatch[0].trim() : '';

  // 提取年份
  const yearMatch = html.match(/>(\d{4})</);
  const yearText = yearMatch ? yearMatch[1] : 'unknown';

  return {
    id,
    title: titleText,
    poster: coverUrl,
    episodes: matches,
    episodes_titles,
    source: apiSite.key,
    source_name: apiSite.name,
    class: '',
    year: yearText,
    desc: descText,
    type_name: '',
    douban_id: 0,
  };
}
