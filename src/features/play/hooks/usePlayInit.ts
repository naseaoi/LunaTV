import { Dispatch, MutableRefObject, SetStateAction, useEffect } from 'react';

import { filterSourcesForPlayback } from '@/lib/source_match';
import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

import { calculateSourceScore } from '@/features/play/lib/playUtils';

// ---------------------------------------------------------------------------
// preferBestSource — 播放源优选
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

  const batchSize = Math.ceil(sources.length / 2);
  const allResults: Array<{
    source: SearchResult;
    testResult: { quality: string; loadSpeed: string; pingTime: number };
  } | null> = [];

  for (let start = 0; start < sources.length; start += batchSize) {
    const batchSources = sources.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batchSources.map(async (source) => {
        try {
          if (!source.episodes || source.episodes.length === 0) {
            console.warn(`播放源 ${source.source_name} 没有可用的播放地址`);
            return null;
          }

          const episodeUrl = source.episodes[0];
          const testResult = await getVideoResolutionFromM3u8(episodeUrl);

          return { source, testResult };
        } catch {
          return null;
        }
      }),
    );
    allResults.push(...batchResults);
  }

  const newVideoInfoMap = new Map<
    string,
    {
      quality: string;
      loadSpeed: string;
      pingTime: number;
      hasError?: boolean;
    }
  >();
  allResults.forEach((result, index) => {
    const source = sources[index];
    const sourceKey = `${source.source}-${source.id}`;

    if (result) {
      newVideoInfoMap.set(sourceKey, result.testResult);
    } else {
      newVideoInfoMap.set(sourceKey, {
        quality: '未知',
        loadSpeed: '未知',
        pingTime: 0,
        hasError: true,
      });
    }
  });

  const successfulResults = allResults.filter(Boolean) as Array<{
    source: SearchResult;
    testResult: { quality: string; loadSpeed: string; pingTime: number };
  }>;

  setPrecomputedVideoInfo(newVideoInfoMap);

  if (successfulResults.length === 0) {
    console.warn('所有播放源测速都失败，使用第一个播放源');
    return sources[0];
  }

  const validSpeeds = successfulResults
    .map((result) => {
      const speedStr = result.testResult.loadSpeed;
      if (speedStr === '未知' || speedStr === '测量中...') return 0;

      const match = speedStr.match(/^([\d.]+)\s*(Mbps|KB\/s|MB\/s)$/);
      if (!match) return 0;

      const value = parseFloat(match[1]);
      const unit = match[2];
      if (unit === 'Mbps') return (value * 1024) / 8;
      return unit === 'MB/s' ? value * 1024 : value;
    })
    .filter((speed) => speed > 0);

  const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

  const validPings = successfulResults
    .map((result) => result.testResult.pingTime)
    .filter((ping) => ping > 0);

  const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
  const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

  const resultsWithScore = successfulResults.map((result) => ({
    ...result,
    score: calculateSourceScore(result.testResult, maxSpeed, minPing, maxPing),
  }));

  resultsWithScore.sort((a, b) => b.score - a.score);

  return resultsWithScore[0].source;
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
      setLoading(false);
    };

    initAll();
  }, []);
}
