'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';

import { getSearchHistory, subscribeToDataUpdates } from '@/lib/db.client';

import PageLayout from '@/components/PageLayout';
import SearchResultFilter from '@/components/SearchResultFilter';
import SearchSuggestions from '@/components/SearchSuggestions';
import VideoCard from '@/components/VideoCard';

import { computeGroupStats } from '@/features/search/lib/searchUtils';
import { useSearchExecution } from '@/features/search/hooks/useSearchExecution';
import {
  useSearchAggregation,
  FilterState,
} from '@/features/search/hooks/useSearchAggregation';
import SearchHistory from '@/features/search/components/SearchHistory';

function SearchPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 搜索历史 & UI 状态
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 过滤器状态
  const [filterAll, setFilterAll] = useState<FilterState>({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none',
  });
  const [filterAgg, setFilterAgg] = useState<FilterState>({
    source: 'all',
    title: 'all',
    year: 'all',
    yearOrder: 'none',
  });

  // 聚合开关
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true;
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 搜索执行
  const {
    isLoading,
    setIsLoading,
    showResults,
    setShowResults,
    searchResults,
    totalSources,
    completedSources,
    useFluidSearch,
  } = useSearchExecution({
    searchParams,
    viewMode,
    filterAggYearOrder: filterAgg.yearOrder,
    filterAllYearOrder: filterAll.yearOrder,
  });

  // 聚合、筛选、排序
  const {
    filterOptions,
    filteredAllResults,
    filteredAggResults,
    getGroupRef,
    groupStatsRef,
  } = useSearchAggregation({
    searchResults,
    filterAll,
    filterAgg,
    searchQuery,
  });

  // 初始化：搜索历史、滚动监听、流式搜索设置
  useEffect(() => {
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    getSearchHistory().then(setSearchHistory);

    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      },
    );

    const getScrollTop = () => document.body.scrollTop || 0;

    let isRunning = false;
    const checkScrollPosition = () => {
      if (!isRunning) return;
      const scrollTop = getScrollTop();
      setShowBackToTop(scrollTop > 300);
      requestAnimationFrame(checkScrollPosition);
    };

    isRunning = true;
    checkScrollPosition();

    const handleScroll = () => {
      const scrollTop = getScrollTop();
      setShowBackToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      unsubscribe();
      isRunning = false;
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // searchParams 变化时同步 searchQuery 和 suggestions
  useEffect(() => {
    const query = searchParams.get('q') || '';
    if (query) {
      setSearchQuery(query);
      setShowSuggestions(false);
    } else {
      setShowSuggestions(false);
    }
  }, [searchParams]);

  // 回调函数
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(value.trim() ? true : false);
  };

  const handleInputFocus = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);
    setShowSuggestions(false);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);

    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const scrollToTop = () => {
    try {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      document.body.scrollTop = 0;
    }
  };

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder='搜索电影、电视剧...'
                autoComplete='off'
                className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-12 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
              />

              {searchQuery && (
                <button
                  type='button'
                  onClick={() => {
                    setSearchQuery('');
                    setShowSuggestions(false);
                    document.getElementById('searchInput')?.focus();
                  }}
                  className='absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300'
                  aria-label='清除搜索内容'
                >
                  <X className='h-5 w-5' />
                </button>
              )}

              <SearchSuggestions
                query={searchQuery}
                isVisible={showSuggestions}
                onSelect={handleSuggestionSelect}
                onClose={() => setShowSuggestions(false)}
                onEnterKey={() => {
                  const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
                  if (!trimmed) return;

                  setSearchQuery(trimmed);
                  setIsLoading(true);
                  setShowResults(true);
                  setShowSuggestions(false);

                  router.push(`/search?q=${encodeURIComponent(trimmed)}`);
                }}
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {showResults ? (
            <section className='mb-12'>
              {/* 标题 */}
              <div className='mb-4'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                  搜索结果
                  {totalSources > 0 && useFluidSearch && (
                    <span className='ml-2 text-sm font-normal text-gray-500 dark:text-gray-400'>
                      {completedSources}/{totalSources}
                    </span>
                  )}
                  {isLoading && useFluidSearch && (
                    <span className='ml-2 inline-block align-middle'>
                      <span className='inline-block h-3 w-3 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin'></span>
                    </span>
                  )}
                </h2>
              </div>
              {/* 筛选器 + 聚合开关 */}
              <div className='mb-8 flex items-center justify-between gap-3'>
                <div className='flex-1 min-w-0'>
                  {viewMode === 'agg' ? (
                    <SearchResultFilter
                      categories={filterOptions.categoriesAgg}
                      values={filterAgg}
                      onChange={(v) => setFilterAgg(v as FilterState)}
                    />
                  ) : (
                    <SearchResultFilter
                      categories={filterOptions.categoriesAll}
                      values={filterAll}
                      onChange={(v) => setFilterAll(v as FilterState)}
                    />
                  )}
                </div>
                <label className='flex items-center gap-2 cursor-pointer select-none shrink-0'>
                  <span className='text-xs sm:text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>
              {searchResults.length === 0 ? (
                isLoading ? (
                  <div className='flex justify-center items-center h-40'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
                  </div>
                ) : (
                  <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相关结果
                  </div>
                )
              ) : (
                <div
                  key={`search-results-${viewMode}`}
                  className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
                >
                  {viewMode === 'agg'
                    ? filteredAggResults.map(([mapKey, group]) => {
                        const title = group[0]?.title || '';
                        const poster = group[0]?.poster || '';
                        const year = group[0]?.year || 'unknown';
                        const { episodes, source_names, douban_id } =
                          computeGroupStats(group);
                        const type = episodes === 1 ? 'movie' : 'tv';

                        if (!groupStatsRef.current.has(mapKey)) {
                          groupStatsRef.current.set(mapKey, {
                            episodes,
                            source_names,
                            douban_id,
                          });
                        }

                        return (
                          <div key={`agg-${mapKey}`} className='w-full'>
                            <VideoCard
                              ref={getGroupRef(mapKey)}
                              from='search'
                              isAggregate={true}
                              title={title}
                              poster={poster}
                              year={year}
                              episodes={episodes}
                              source_names={source_names}
                              douban_id={douban_id}
                              query={
                                searchQuery.trim() !== title
                                  ? searchQuery.trim()
                                  : ''
                              }
                              type={type}
                            />
                          </div>
                        );
                      })
                    : filteredAllResults.map((item) => (
                        <div
                          key={`all-${item.source}-${item.id}`}
                          className='w-full'
                        >
                          <VideoCard
                            id={item.id}
                            title={item.title}
                            poster={item.poster}
                            episodes={item.episodes.length}
                            source={item.source}
                            source_name={item.source_name}
                            douban_id={item.douban_id}
                            query={
                              searchQuery.trim() !== item.title
                                ? searchQuery.trim()
                                : ''
                            }
                            year={item.year}
                            from='search'
                            type={item.episodes.length > 1 ? 'tv' : 'movie'}
                          />
                        </div>
                      ))}
                </div>
              )}
            </section>
          ) : (
            <SearchHistory
              searchHistory={searchHistory}
              setSearchQuery={setSearchQuery}
            />
          )}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

function SearchPageSkeleton() {
  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        <div className='mb-8'>
          <div className='max-w-2xl mx-auto'>
            <div className='w-full h-12 rounded-lg bg-gray-50/80 border border-gray-200/50 dark:bg-gray-800 dark:border-gray-700' />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageClient />
    </Suspense>
  );
}
