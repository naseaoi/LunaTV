import {
  collapseSourcesForDisplay,
  getSourceBundle,
  mergeSourceBundle,
} from '@/lib/source-bundle';
import { SearchResult } from '@/lib/types';

function buildSource(partial: Partial<SearchResult>): SearchResult {
  return {
    id: partial.id || '1',
    title: partial.title || '测试标题',
    poster: partial.poster || '',
    episodes: partial.episodes || [],
    episodes_titles: partial.episodes_titles || [],
    source: partial.source || 'giri',
    source_name: partial.source_name || 'Girigiri',
    year: partial.year || '2024',
    class: partial.class,
    desc: partial.desc,
    type_name: partial.type_name,
    douban_id: partial.douban_id,
    variant_label: partial.variant_label,
    related_sources: partial.related_sources,
  };
}

describe('mergeSourceBundle', () => {
  it('会用主详情替换当前源，并把 related_sources 一起合入', () => {
    const primary = buildSource({
      id: '123',
      episodes: ['a.m3u8'],
      episodes_titles: ['01'],
      related_sources: [
        buildSource({
          id: '123__giri_2',
          episodes_titles: ['01', '02'],
          variant_label: '简中',
        }),
      ],
    });

    const merged = mergeSourceBundle(
      [
        buildSource({ id: '123', title: '旧数据' }),
        buildSource({ source: 'other', id: 'x1', source_name: 'Other' }),
      ],
      primary,
    );

    expect(merged.map((item) => `${item.source}-${item.id}`)).toEqual([
      'giri-123',
      'giri-123__giri_2',
      'other-x1',
    ]);
    expect(merged[0].episodes).toEqual(['a.m3u8']);
    expect(merged[1].variant_label).toBe('简中');
  });
});

describe('getSourceBundle', () => {
  it('会把默认版本排到前面，便于在选集页展示版本切换', () => {
    const selectedVariant = buildSource({
      id: '123__giri_2',
      variant_label: '简中',
      related_sources: [
        buildSource({ id: '123', variant_label: '繁中' }),
        buildSource({ id: '123__giri_3', variant_label: '粤语' }),
      ],
    });

    expect(getSourceBundle(selectedVariant).map((item) => item.id)).toEqual([
      '123',
      '123__giri_2',
      '123__giri_3',
    ]);
  });
});

describe('collapseSourcesForDisplay', () => {
  it('会把 giri 多版本折叠成一个源站入口', () => {
    const sources = [
      buildSource({ id: '123', variant_label: '繁中' }),
      buildSource({ id: '123__giri_2', variant_label: '简中' }),
      buildSource({ source: 'other', id: 'x1', source_name: 'Other' }),
    ];

    expect(
      collapseSourcesForDisplay(sources).map(
        (item) => `${item.source}-${item.id}`,
      ),
    ).toEqual(['giri-123', 'other-x1']);
  });

  it('当前正在播放非默认版本时，会保留当前版本作为折叠后的入口', () => {
    const sources = [
      buildSource({ id: '123', variant_label: '繁中' }),
      buildSource({ id: '123__giri_2', variant_label: '简中' }),
    ];

    expect(
      collapseSourcesForDisplay(sources, 'giri', '123__giri_2').map(
        (item) => item.id,
      ),
    ).toEqual(['123__giri_2']);
  });

  it('会把同一源站的不同视频 ID 折叠成一个入口', () => {
    const sources = [
      buildSource({ id: '123' }),
      buildSource({ id: '456' }),
      buildSource({ source: 'other', id: 'x1', source_name: 'Other' }),
    ];

    expect(
      collapseSourcesForDisplay(sources).map(
        (item) => `${item.source}-${item.id}`,
      ),
    ).toEqual(['giri-123', 'other-x1']);
  });
});
