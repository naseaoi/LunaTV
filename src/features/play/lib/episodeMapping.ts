import { SearchResult } from '@/lib/types';

export interface ResolvedEpisodeTarget {
  index: number;
  preserveProgress: boolean;
}

function normalizeEpisodeTitle(title: string): string {
  return title.normalize('NFKC').trim().toLowerCase();
}

export function extractEpisodeNumberFromTitle(title: string): number | null {
  const normalizedTitle = normalizeEpisodeTitle(title);
  if (!normalizedTitle) {
    return null;
  }

  const isSpecialEpisode =
    /^(?:sp|ova|oad|special|pv|cm)\s*[-_.]?\s*\d*/i.test(normalizedTitle) ||
    /特别篇|总集篇|预告|先行/.test(normalizedTitle);

  if (isSpecialEpisode) {
    return null;
  }

  const explicitMatch = normalizedTitle.match(
    /(?:第\s*|ep(?:isode)?\s*)?(\d+(?:\.\d+)?)(?:\s*[集话篇章]|$)/i,
  );
  if (explicitMatch) {
    const episodeNumber = Number.parseFloat(explicitMatch[1]);
    return Number.isFinite(episodeNumber) ? episodeNumber : null;
  }

  const genericMatch = normalizedTitle.match(/(\d+(?:\.\d+)?)/);
  if (!genericMatch) {
    return null;
  }

  const episodeNumber = Number.parseFloat(genericMatch[1]);
  return Number.isFinite(episodeNumber) ? episodeNumber : null;
}

export function resolveEpisodeTargetIndex(
  currentDetail: SearchResult | null,
  currentIndex: number,
  targetDetail: SearchResult | null,
): ResolvedEpisodeTarget {
  const targetEpisodes = targetDetail?.episodes || [];
  if (targetEpisodes.length === 0) {
    return { index: 0, preserveProgress: false };
  }

  const safeCurrentIndex = Number.isInteger(currentIndex)
    ? Math.max(0, currentIndex)
    : 0;
  const fallbackIndex =
    safeCurrentIndex < targetEpisodes.length ? safeCurrentIndex : 0;
  const fallbackPreserveProgress = safeCurrentIndex < targetEpisodes.length;

  // 先按源站给出的集标题提取逻辑集数，避免不同源的数组下标不一致时跳错集。
  const currentEpisodeLabel =
    currentDetail?.episodes_titles?.[safeCurrentIndex] ||
    `${safeCurrentIndex + 1}`;
  const currentEpisodeNumber =
    extractEpisodeNumberFromTitle(currentEpisodeLabel);

  if (currentEpisodeNumber !== null) {
    const targetTitles = targetDetail?.episodes_titles || [];
    const matchedIndex = targetTitles.findIndex((title, index) => {
      const candidate = title || `${index + 1}`;
      return extractEpisodeNumberFromTitle(candidate) === currentEpisodeNumber;
    });

    if (matchedIndex >= 0) {
      return { index: matchedIndex, preserveProgress: true };
    }

    if (
      Number.isInteger(currentEpisodeNumber) &&
      currentEpisodeNumber >= 1 &&
      currentEpisodeNumber <= targetEpisodes.length
    ) {
      return {
        index: currentEpisodeNumber - 1,
        preserveProgress: true,
      };
    }
  }

  return {
    index: fallbackIndex,
    preserveProgress: fallbackPreserveProgress,
  };
}
