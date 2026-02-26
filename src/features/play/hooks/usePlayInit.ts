import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import { filterSourcesForPlayback } from '@/lib/source_match';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/hls-utils';

import { calculateSourceScore } from '@/features/play/lib/playUtils';

// ---------------------------------------------------------------------------
// preferBestSource — 播放源优选（竞速模式）
// 所有源同时并发测试，首个成功后启动短暂收割窗口，窗口结束后从已收集
// 结果中选最优源。快源不再被慢源拖累，大幅缩短用户等待时间。
// ---------------------------------------------------------------------------

export async function preferBestSource(
  sources: SearchResult[],
  setPrecomputedVideoInfo: Dispatch<
    SetStateAction<
      Map<string, { quality: string; loadSpeed: string; pingTime: number }>
    >
  >,
): Promise<SearchResult> {
  if (sources.length === 1) return sources[0];

  // 收割窗口：首个源测速成功后，再等待此时间收集更多结果
  const HARVEST_WINDOW_MS = 1500;

  type TestResult = {
    source: SearchResult;
    testResult: { quality: string; loadSpeed: string; pingTime: number };
  };

  const collectedResults: TestResult[] = [];
  let harvestTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  return new Promise<SearchResult>((resolveMain) => {
    // 最终从已收集结果中选出最优源并返回
    const finalize = () => {
      if (settled) return;
      settled = true;
      if (harvestTimer) clearTimeout(harvestTimer);

      // 构建预计算 Map（SourcesTab 复用）
      const newVideoInfoMap = new Map<
        string,
        {
          quality: string;
          loadSpeed: string;
          pingTime: number;
          hasError?: boolean;
        }
      >();
      const collectedKeys = new Set<string>();
      for (const r of collectedResults) {
        const key = `${r.source.source}-${r.source.id}`;
        newVideoInfoMap.set(key, r.testResult);
        collectedKeys.add(key);
      }
      // 未完成的源标记为 hasError，后续 SourcesTab 会自行重新测速
      for (const s of sources) {
        const key = `${s.source}-${s.id}`;
        if (!collectedKeys.has(key)) {
          newVideoInfoMap.set(key, {
            quality: '未知',
            loadSpeed: '未知',
            pingTime: 0,
            hasError: true,
          });
        }
      }
      setPrecomputedVideoInfo(newVideoInfoMap);

      if (collectedResults.length === 0) {
        resolveMain(sources[0]);
        return;
      }

      // 评分排序
      const validSpeeds = collectedResults
        .map((r) => {
          const m = r.testResult.loadSpeed.match(
            /^([\d.]+)\s*(Mbps|KB\/s|MB\/s)$/,
          );
          if (!m) return 0;
          const v = parseFloat(m[1]);
          const u = m[2];
          if (u === 'Mbps') return (v * 1024) / 8;
          return u === 'MB/s' ? v * 1024 : v;
        })
        .filter((s) => s > 0);
      const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;
      const validPings = collectedResults
        .map((r) => r.testResult.pingTime)
        .filter((p) => p > 0);
      const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
      const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

      const scored = collectedResults.map((r) => ({
        ...r,
        score: calculateSourceScore(r.testResult, maxSpeed, minPing, maxPing),
      }));
      scored.sort((a, b) => b.score - a.score);
      resolveMain(scored[0].source);
    };

    // 全量并发测试
    let pendingCount = sources.length;
    for (const source of sources) {
      if (!source.episodes || source.episodes.length === 0) {
        pendingCount--;
        if (pendingCount === 0) finalize();
        continue;
      }
      getVideoResolutionFromM3u8(source.episodes[0])
        .then((testResult) => {
          if (settled) return;
          collectedResults.push({ source, testResult });
          // 首个成功：启动收割窗口
          if (!harvestTimer) {
            harvestTimer = setTimeout(finalize, HARVEST_WINDOW_MS);
          }
        })
        .catch(() => {
          // 测速失败，不计入
        })
        .finally(() => {
          pendingCount--;
          // 所有源都完成了（无论成败），直接 finalize
          if (pendingCount === 0 && !settled) finalize();
        });
    }
  });
}

// ---------------------------------------------------------------------------
// updateVideoUrl — 更新视频播放地址
// ---------------------------------------------------------------------------

export function updateVideoUrl(
  detailData: SearchResult | null,
  episodeIndex: number,
  currentVideoUrl: string,
  setVideoUrl: Dispatch<SetStateAction<string>>,
) {
  if (
    !detailData ||
    !detailData.episodes ||
    episodeIndex >= detailData.episodes.length
  ) {
    setVideoUrl('');
    return;
  }
  const newUrl = detailData?.episodes[episodeIndex] || '';
  if (newUrl !== currentVideoUrl) {
    setVideoUrl(newUrl);
  }
}

// ---------------------------------------------------------------------------
// usePlayInit — 入口初始化 hook
// ---------------------------------------------------------------------------

interface UsePlayInitParams {
  currentSource: string;
  currentId: string;
  videoTitle: string;
  searchTitle: string;
  searchType: string;
  needPreferRef: MutableRefObject<boolean>;
  videoTitleRef: MutableRefObject<string>;
  videoYearRef: MutableRefObject<string>;
  currentEpisodeIndex: number;
  optimizationEnabled: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setLoadingStage: Dispatch<
    SetStateAction<'searching' | 'preferring' | 'fetching' | 'ready'>
  >;
  setLoadingMessage: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setDetail: Dispatch<SetStateAction<SearchResult | null>>;
  setCurrentSource: Dispatch<SetStateAction<string>>;
  setCurrentId: Dispatch<SetStateAction<string>>;
  setVideoTitle: Dispatch<SetStateAction<string>>;
  setVideoYear: Dispatch<SetStateAction<string>>;
  setVideoCover: Dispatch<SetStateAction<string>>;
  setVideoDoubanId: Dispatch<SetStateAction<number>>;
  setCurrentEpisodeIndex: Dispatch<SetStateAction<number>>;
  setNeedPrefer: Dispatch<SetStateAction<boolean>>;
  setAvailableSources: Dispatch<SetStateAction<SearchResult[]>>;
  setSourceSearchLoading: Dispatch<SetStateAction<boolean>>;
  setSourceSearchError: Dispatch<SetStateAction<string | null>>;
  setPrecomputedVideoInfo: Dispatch<
    SetStateAction<
      Map<string, { quality: string; loadSpeed: string; pingTime: number }>
    >
  >;
}

export function usePlayInit({
  currentSource,
  currentId,
  videoTitle,
  searchTitle,
  searchType,
  needPreferRef,
  videoTitleRef,
  videoYearRef,
  currentEpisodeIndex,
  optimizationEnabled,
  setLoading,
  setLoadingStage,
  setLoadingMessage,
  setError,
  setDetail,
  setCurrentSource,
  setCurrentId,
  setVideoTitle,
  setVideoYear,
  setVideoCover,
  setVideoDoubanId,
  setCurrentEpisodeIndex,
  setNeedPrefer,
  setAvailableSources,
  setSourceSearchLoading,
  setSourceSearchError,
  setPrecomputedVideoInfo,
}: UsePlayInitParams) {
  useEffect(() => {
    const fetchSourceDetail = async (
      source: string,
      id: string,
    ): Promise<SearchResult[]> => {
      try {
        const detailResponse = await fetch(
          `/api/detail?source=${source}&id=${id}`,
        );
        if (!detailResponse.ok) {
          throw new Error('获取视频详情失败');
        }
        const detailData = (await detailResponse.json()) as SearchResult;
        setAvailableSources([detailData]);
        return [detailData];
      } catch (err) {
        console.error('获取视频详情失败:', err);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const fetchSourcesData = async (query: string): Promise<SearchResult[]> => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        const data = await response.json();

        const results = filterSourcesForPlayback(data.results, {
          title: videoTitleRef.current,
          year: videoYearRef.current,
          searchType:
            searchType === 'tv' || searchType === 'movie' ? searchType : '',
        });
        setAvailableSources(results);
        return results;
      } catch (err) {
        setSourceSearchError(err instanceof Error ? err.message : '搜索失败');
        setAvailableSources([]);
        return [];
      } finally {
        setSourceSearchLoading(false);
      }
    };

    const initAll = async () => {
      if (!currentSource && !currentId && !videoTitle && !searchTitle) {
        setError('缺少必要参数');
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadingStage(currentSource && currentId ? 'fetching' : 'searching');
      setLoadingMessage(
        currentSource && currentId
          ? '正在获取视频详情...'
          : '正在搜索播放源...',
      );

      let sourcesInfo = await fetchSourcesData(searchTitle || videoTitle);
      if (
        currentSource &&
        currentId &&
        !sourcesInfo.some(
          (source) =>
            source.source === currentSource && source.id === currentId,
        )
      ) {
        sourcesInfo = await fetchSourceDetail(currentSource, currentId);
      }
      if (sourcesInfo.length === 0) {
        setError('未找到匹配结果');
        setLoading(false);
        return;
      }

      let detailData: SearchResult = sourcesInfo[0];
      if (currentSource && currentId && !needPreferRef.current) {
        const target = sourcesInfo.find(
          (source) =>
            source.source === currentSource && source.id === currentId,
        );
        if (target) {
          detailData = target;
        } else {
          setError('未找到匹配结果');
          setLoading(false);
          return;
        }
      }

      if (
        (!currentSource || !currentId || needPreferRef.current) &&
        optimizationEnabled
      ) {
        setLoadingStage('preferring');
        setLoadingMessage('正在优选最佳播放源...');

        detailData = await preferBestSource(
          sourcesInfo,
          setPrecomputedVideoInfo,
        );
      }

      setNeedPrefer(false);
      setCurrentSource(detailData.source);
      setCurrentId(detailData.id);
      setVideoYear(detailData.year);
      setVideoTitle(detailData.title || videoTitleRef.current);
      setVideoCover(detailData.poster);
      setVideoDoubanId(detailData.douban_id || 0);
      setDetail(detailData);
      if (currentEpisodeIndex >= detailData.episodes.length) {
        setCurrentEpisodeIndex(0);
      }

      // 规范URL参数
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('source', detailData.source);
      newUrl.searchParams.set('id', detailData.id);
      newUrl.searchParams.set('year', detailData.year);
      newUrl.searchParams.set('title', detailData.title);
      newUrl.searchParams.delete('prefer');
      window.history.replaceState({}, '', newUrl.toString());

      setLoadingStage('ready');
      setLoadingMessage('准备就绪，即将开始播放...');
      // 等进度条动画跑满 100% 后再切换到播放页
      await new Promise((r) => setTimeout(r, 600));
      setLoading(false);
    };

    initAll();
  }, []);
}
