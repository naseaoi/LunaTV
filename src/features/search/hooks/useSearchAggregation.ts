import React, { useEffect, useMemo, useRef } from 'react';

import { SearchResult } from '@/lib/types';
import { VideoCardHandle } from '@/components/VideoCard';
import { SearchFilterCategory } from '@/components/SearchResultFilter';

import {
  normalizeTitleForAggregation,
  compareYear,
  computeGroupStats,
} from '../lib/searchUtils';

export type FilterState = {
  source: string;
  title: string;
  year: string;
  yearOrder: 'none' | 'asc' | 'desc';
};

interface UseSearchAggregationParams {
  searchResults: SearchResult[];
  filterAll: FilterState;
  filterAgg: FilterState;
  searchQuery: string;
}

export function useSearchAggregation({
  searchResults,
  filterAll,
  filterAgg,
  searchQuery,
}: UseSearchAggregationParams) {
  // 聚合卡片 refs 与统计缓存
  const groupRefs = useRef<Map<string, React.RefObject<VideoCardHandle>>>(
    new Map(),
  );
  const groupStatsRef = useRef<
    Map<
      string,
      { douban_id?: number; episodes?: number; source_names: string[] }
    >
  >(new Map());

  const getGroupRef = (key: string) => {
    let ref = groupRefs.current.get(key);
    if (!ref) {
      ref = React.createRef<VideoCardHandle>();
      groupRefs.current.set(key, ref);
    }
    return ref;
  };

  // 聚合后的结果（按标题和年份分组）
  const aggregatedResults = useMemo(() => {
    const titleBuckets = new Map<string, SearchResult[]>();
    const titleOrder: string[] = [];

    searchResults.forEach((item) => {
      const normalizedTitle = normalizeTitleForAggregation(item.title || '');
      if (!normalizedTitle) {
        return;
      }
      if (!titleBuckets.has(normalizedTitle)) {
        titleBuckets.set(normalizedTitle, []);
        titleOrder.push(normalizedTitle);
      }
      titleBuckets.get(normalizedTitle)!.push(item);
    });

    const groupedResults: [string, SearchResult[]][] = [];

    titleOrder.forEach((normalizedTitle) => {
      const bucket = titleBuckets.get(normalizedTitle) || [];
      if (bucket.length === 0) return;

      const yearMap = new Map<string, SearchResult[]>();
      const yearOrder: string[] = [];

      bucket.forEach((item) => {
        const normalizedYear =
          item.year && item.year !== 'unknown' ? item.year : 'unknown';
        if (!yearMap.has(normalizedYear)) {
          yearMap.set(normalizedYear, []);
          yearOrder.push(normalizedYear);
        }
        yearMap.get(normalizedYear)!.push(item);
      });

      const knownYears = yearOrder.filter((year) => year !== 'unknown');
      const unknownItems = yearMap.get('unknown') || [];

      if (unknownItems.length > 0) {
        if (knownYears.length === 1) {
          yearMap.get(knownYears[0])!.push(...unknownItems);
          yearMap.delete('unknown');
        }
      }

      yearOrder
        .filter((year) => yearMap.has(year))
        .forEach((year) => {
          groupedResults.push([
            `${normalizedTitle}-${year}`,
            yearMap.get(year)!,
          ]);
        });
    });

    return groupedResults;
  }, [searchResults]);

  // 聚合增量更新：对比变化并调用卡片 ref 的 set 方法
  useEffect(() => {
    aggregatedResults.forEach(([mapKey, group]) => {
      const stats = computeGroupStats(group);
      const prev = groupStatsRef.current.get(mapKey);
      if (!prev) {
        groupStatsRef.current.set(mapKey, stats);
        return;
      }
      const ref = groupRefs.current.get(mapKey);
      if (ref && ref.current) {
        if (prev.episodes !== stats.episodes) {
          ref.current.setEpisodes(stats.episodes);
        }
        const prevNames = (prev.source_names || []).join('|');
        const nextNames = (stats.source_names || []).join('|');
        if (prevNames !== nextNames) {
          ref.current.setSourceNames(stats.source_names);
        }
        if (prev.douban_id !== stats.douban_id) {
          ref.current.setDoubanId(stats.douban_id);
        }
        groupStatsRef.current.set(mapKey, stats);
      }
    });
  }, [aggregatedResults]);

  // 构建筛选选项
  const filterOptions = useMemo(() => {
    const sourcesSet = new Map<string, string>();
    const titlesSet = new Set<string>();
    const yearsSet = new Set<string>();

    searchResults.forEach((item) => {
      if (item.source && item.source_name) {
        sourcesSet.set(item.source, item.source_name);
      }
      if (item.title) titlesSet.add(item.title);
      if (item.year) yearsSet.add(item.year);
    });

    const sourceOptions: { label: string; value: string }[] = [
      { label: '全部来源', value: 'all' },
      ...Array.from(sourcesSet.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ label, value })),
    ];

    const titleOptions: { label: string; value: string }[] = [
      { label: '全部标题', value: 'all' },
      ...Array.from(titlesSet.values())
        .sort((a, b) => a.localeCompare(b))
        .map((t) => ({ label: t, value: t })),
    ];

    const years = Array.from(yearsSet.values());
    const knownYears = years
      .filter((y) => y !== 'unknown')
      .sort((a, b) => parseInt(b) - parseInt(a));
    const hasUnknown = years.includes('unknown');
    const yearOptions: { label: string; value: string }[] = [
      { label: '全部年份', value: 'all' },
      ...knownYears.map((y) => ({ label: y, value: y })),
      ...(hasUnknown ? [{ label: '未知', value: 'unknown' }] : []),
    ];

    const categoriesAll: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    const categoriesAgg: SearchFilterCategory[] = [
      { key: 'source', label: '来源', options: sourceOptions },
      { key: 'title', label: '标题', options: titleOptions },
      { key: 'year', label: '年份', options: yearOptions },
    ];

    return { categoriesAll, categoriesAgg };
  }, [searchResults]);

  // 非聚合筛选+排序
  const filteredAllResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAll;
    const filtered = searchResults.filter((item) => {
      if (source !== 'all' && item.source !== source) return false;
      if (title !== 'all' && item.title !== title) return false;
      if (year !== 'all' && item.year !== year) return false;
      return true;
    });

    if (yearOrder === 'none') {
      return filtered;
    }

    return filtered.sort((a, b) => {
      const yearComp = compareYear(a.year, b.year, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExactMatch = a.title === searchQuery.trim();
      const bExactMatch = b.title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      return yearOrder === 'asc'
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    });
  }, [searchResults, filterAll, searchQuery]);

  // 聚合筛选+排序
  const filteredAggResults = useMemo(() => {
    const { source, title, year, yearOrder } = filterAgg;
    const filtered = aggregatedResults.filter(([, group]) => {
      const gTitle = group[0]?.title ?? '';
      const gYear = group[0]?.year ?? 'unknown';
      const hasSource =
        source === 'all' ? true : group.some((item) => item.source === source);
      if (!hasSource) return false;
      if (title !== 'all' && gTitle !== title) return false;
      if (year !== 'all' && gYear !== year) return false;
      return true;
    });

    if (yearOrder === 'none') {
      return filtered;
    }

    return filtered.sort((a, b) => {
      const aYear = a[1][0].year;
      const bYear = b[1][0].year;
      const yearComp = compareYear(aYear, bYear, yearOrder);
      if (yearComp !== 0) return yearComp;

      const aExactMatch = a[1][0].title === searchQuery.trim();
      const bExactMatch = b[1][0].title === searchQuery.trim();
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      const aTitle = a[1][0].title;
      const bTitle = b[1][0].title;
      return yearOrder === 'asc'
        ? aTitle.localeCompare(bTitle)
        : bTitle.localeCompare(aTitle);
    });
  }, [aggregatedResults, filterAgg, searchQuery]);

  return {
    aggregatedResults,
    filterOptions,
    filteredAllResults,
    filteredAggResults,
    getGroupRef,
    groupStatsRef,
  };
}
