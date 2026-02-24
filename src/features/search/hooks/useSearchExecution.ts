import { startTransition, useEffect, useRef, useState } from 'react';
import { ReadonlyURLSearchParams } from 'next/navigation';

import { addSearchHistory } from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import { sortBatchForNoOrder } from '../lib/searchUtils';

interface UseSearchExecutionParams {
  searchParams: ReadonlyURLSearchParams;
  viewMode: 'agg' | 'all';
  filterAggYearOrder: 'none' | 'asc' | 'desc';
  filterAllYearOrder: 'none' | 'asc' | 'desc';
}

export function useSearchExecution({
  searchParams,
  viewMode,
  filterAggYearOrder,
  filterAllYearOrder,
}: UseSearchExecutionParams) {
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [totalSources, setTotalSources] = useState(0);
  const [completedSources, setCompletedSources] = useState(0);
  const [useFluidSearch, setUseFluidSearch] = useState(true);

  const currentQueryRef = useRef<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingResultsRef = useRef<SearchResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  // 核心搜索 effect
  useEffect(() => {
    const query = searchParams.get('q') || '';
    currentQueryRef.current = query.trim();

    if (query) {
      // 新搜索：关闭旧连接并清空结果
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      setSearchResults([]);
      setTotalSources(0);
      setCompletedSources(0);
      pendingResultsRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      setIsLoading(true);
      setShowResults(true);

      const trimmed = query.trim();

      // 每次搜索时重新读取设置
      let currentFluidSearch = true;
      if (typeof window !== 'undefined') {
        const savedFluidSearch = localStorage.getItem('fluidSearch');
        if (savedFluidSearch !== null) {
          currentFluidSearch = JSON.parse(savedFluidSearch);
        } else {
          const defaultFluidSearch =
            window.RUNTIME_CONFIG?.FLUID_SEARCH !== false;
          currentFluidSearch = defaultFluidSearch;
        }
      }
      setUseFluidSearch(currentFluidSearch);

      if (currentFluidSearch) {
        // 流式搜索
        const es = new EventSource(
          `/api/search/ws?q=${encodeURIComponent(trimmed)}`,
        );
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          if (!event.data) return;
          try {
            const payload = JSON.parse(event.data);
            if (currentQueryRef.current !== trimmed) return;
            switch (payload.type) {
              case 'start':
                setTotalSources(payload.totalSources || 0);
                setCompletedSources(0);
                break;
              case 'source_result': {
                setCompletedSources((prev) => prev + 1);
                if (
                  Array.isArray(payload.results) &&
                  payload.results.length > 0
                ) {
                  const activeYearOrder =
                    viewMode === 'agg'
                      ? filterAggYearOrder
                      : filterAllYearOrder;
                  const incoming: SearchResult[] =
                    activeYearOrder === 'none'
                      ? sortBatchForNoOrder(
                          payload.results as SearchResult[],
                          currentQueryRef.current,
                        )
                      : (payload.results as SearchResult[]);
                  pendingResultsRef.current.push(...incoming);
                  if (!flushTimerRef.current) {
                    flushTimerRef.current = window.setTimeout(() => {
                      const toAppend = pendingResultsRef.current;
                      pendingResultsRef.current = [];
                      startTransition(() => {
                        setSearchResults((prev) => prev.concat(toAppend));
                      });
                      flushTimerRef.current = null;
                    }, 80);
                  }
                }
                break;
              }
              case 'source_error':
                setCompletedSources((prev) => prev + 1);
                break;
              case 'complete':
                setCompletedSources(payload.completedSources || 0);
                // 完成前确保将缓冲写入
                if (pendingResultsRef.current.length > 0) {
                  const toAppend = pendingResultsRef.current;
                  pendingResultsRef.current = [];
                  if (flushTimerRef.current) {
                    clearTimeout(flushTimerRef.current);
                    flushTimerRef.current = null;
                  }
                  startTransition(() => {
                    setSearchResults((prev) => prev.concat(toAppend));
                  });
                }
                setIsLoading(false);
                try {
                  es.close();
                } catch {}
                if (eventSourceRef.current === es) {
                  eventSourceRef.current = null;
                }
                break;
            }
          } catch {}
        };

        es.onerror = () => {
          setIsLoading(false);
          if (pendingResultsRef.current.length > 0) {
            const toAppend = pendingResultsRef.current;
            pendingResultsRef.current = [];
            if (flushTimerRef.current) {
              clearTimeout(flushTimerRef.current);
              flushTimerRef.current = null;
            }
            startTransition(() => {
              setSearchResults((prev) => prev.concat(toAppend));
            });
          }
          try {
            es.close();
          } catch {}
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
          }
        };
      } else {
        // 传统搜索
        fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
          .then((response) => response.json())
          .then((data) => {
            if (currentQueryRef.current !== trimmed) return;

            if (data.results && Array.isArray(data.results)) {
              const activeYearOrder =
                viewMode === 'agg' ? filterAggYearOrder : filterAllYearOrder;
              const results: SearchResult[] =
                activeYearOrder === 'none'
                  ? sortBatchForNoOrder(
                      data.results as SearchResult[],
                      currentQueryRef.current,
                    )
                  : (data.results as SearchResult[]);

              setSearchResults(results);
              setTotalSources(1);
              setCompletedSources(1);
            }
            setIsLoading(false);
          })
          .catch(() => {
            setIsLoading(false);
          });
      }

      // 保存到搜索历史
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  // 组件卸载时清理连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingResultsRef.current = [];
    };
  }, []);

  return {
    isLoading,
    setIsLoading,
    showResults,
    setShowResults,
    searchResults,
    totalSources,
    completedSources,
    useFluidSearch,
    setUseFluidSearch,
  };
}
