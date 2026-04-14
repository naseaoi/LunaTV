import { SearchResult } from '@/lib/types';

interface SourceVariantMeta {
  videoId: string;
  groupId: number | null;
}

const GIRI_VARIANT_ID_REGEX = /^(.*)__giri_(\d+)$/;

function parseVariantMeta(id: string): SourceVariantMeta {
  const match = id.match(GIRI_VARIANT_ID_REGEX);
  if (!match) {
    return { videoId: id, groupId: null };
  }

  return {
    videoId: match[1],
    groupId: Number.parseInt(match[2], 10),
  };
}

function getSourceKey(item: Pick<SearchResult, 'source' | 'id'>): string {
  return `${item.source}-${item.id}`;
}

function compareBundleItems(a: SearchResult, b: SearchResult): number {
  if (a.source !== b.source) {
    return 0;
  }

  const aMeta = parseVariantMeta(a.id);
  const bMeta = parseVariantMeta(b.id);
  if (aMeta.videoId !== bMeta.videoId) {
    return 0;
  }

  if (aMeta.groupId === null && bMeta.groupId !== null) {
    return -1;
  }
  if (aMeta.groupId !== null && bMeta.groupId === null) {
    return 1;
  }
  if (aMeta.groupId === null && bMeta.groupId === null) {
    return 0;
  }

  return (aMeta.groupId || 0) - (bMeta.groupId || 0);
}

function dedupeSources(sources: SearchResult[]): SearchResult[] {
  const deduped: SearchResult[] = [];
  const seen = new Set<string>();

  for (const item of sources) {
    const key = getSourceKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function getSourceBundle(primary: SearchResult): SearchResult[] {
  return dedupeSources([primary, ...(primary.related_sources || [])]).sort(
    compareBundleItems,
  );
}

export function mergeSourceBundle(
  sources: SearchResult[],
  primary: SearchResult,
): SearchResult[] {
  const bundle = getSourceBundle(primary);
  const bundleKeys = new Set(bundle.map((item) => getSourceKey(item)));
  const preserved = sources.filter(
    (item) => !bundleKeys.has(getSourceKey(item)),
  );

  return [...bundle, ...preserved];
}

export function collapseSourcesForDisplay(
  sources: SearchResult[],
  currentSource?: string,
  currentId?: string,
): SearchResult[] {
  const sourceGroups = new Map<string, SearchResult[]>();

  for (const item of sources) {
    const group = sourceGroups.get(item.source);
    if (group) {
      group.push(item);
    } else {
      sourceGroups.set(item.source, [item]);
    }
  }

  const collapsed: SearchResult[] = [];
  const seenSources = new Set<string>();

  for (const item of sources) {
    if (seenSources.has(item.source)) {
      continue;
    }
    seenSources.add(item.source);

    const group = sourceGroups.get(item.source)!;
    if (group.length === 1) {
      collapsed.push(item);
      continue;
    }

    // Multiple items from the same source – pick the best representative
    const currentItem = group.find(
      (g) => g.source === currentSource && g.id === currentId,
    );
    if (currentItem) {
      collapsed.push(currentItem);
      continue;
    }

    const defaultItem = group.find(
      (g) => parseVariantMeta(g.id).groupId === null,
    );
    collapsed.push(defaultItem || group[0]);
  }

  return collapsed;
}
