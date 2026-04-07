import type { SearchResult } from '@/lib/types';

import {
  extractEpisodeNumberFromTitle,
  resolveEpisodeTargetIndex,
} from '@/features/play/lib/episodeMapping';

function createSearchResult(partial: Partial<SearchResult>): SearchResult {
  return {
    id: '1',
    title: 'test',
    poster: '',
    episodes: [],
    episodes_titles: [],
    source: 'source-a',
    source_name: 'Source A',
    year: '2026',
    ...partial,
  };
}

describe('episodeMapping', () => {
  it('能从常见集标题里提取集数', () => {
    expect(extractEpisodeNumberFromTitle('第06集')).toBe(6);
    expect(extractEpisodeNumberFromTitle('EP 12')).toBe(12);
    expect(extractEpisodeNumberFromTitle('01')).toBe(1);
    expect(extractEpisodeNumberFromTitle('SP1')).toBeNull();
    expect(extractEpisodeNumberFromTitle('特别篇')).toBeNull();
  });

  it('换源时会按逻辑集数映射到目标源，而不是直接复用数组下标', () => {
    const currentDetail = createSearchResult({
      episodes: ['a1', 'a2', 'a3'],
      episodes_titles: ['01', '02', '03'],
    });
    const targetDetail = createSearchResult({
      source: 'source-b',
      source_name: 'Source B',
      episodes: ['sp', 'b1', 'b2', 'b3'],
      episodes_titles: ['特别篇', '第1集', '第2集', '第3集'],
    });

    expect(resolveEpisodeTargetIndex(currentDetail, 1, targetDetail)).toEqual({
      index: 2,
      preserveProgress: true,
    });
  });

  it('目标源没有对应集数时会回退到安全索引', () => {
    const currentDetail = createSearchResult({
      episodes: ['a1', 'a2', 'a3'],
      episodes_titles: ['01', '02', '03'],
    });
    const targetDetail = createSearchResult({
      source: 'source-b',
      source_name: 'Source B',
      episodes: ['b1'],
      episodes_titles: ['第1集'],
    });

    expect(resolveEpisodeTargetIndex(currentDetail, 2, targetDetail)).toEqual({
      index: 0,
      preserveProgress: false,
    });
  });
});
