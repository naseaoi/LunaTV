import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface EpisodesTabProps {
  totalEpisodes: number;
  episodes_titles: string[];
  episodesPerPage: number;
  value: number;
  onChange?: (episodeNumber: number) => void;
}

export const EpisodesTab: React.FC<EpisodesTabProps> = ({
  totalEpisodes,
  episodes_titles,
  episodesPerPage,
  value,
  onChange,
}) => {
  const pageCount = Math.ceil(totalEpisodes / episodesPerPage);
  const initialPage = Math.floor((value - 1) / episodesPerPage);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const categoriesAsc = useMemo(() => {
    return Array.from({ length: pageCount }, (_, i) => {
      const start = i * episodesPerPage + 1;
      const end = Math.min(start + episodesPerPage - 1, totalEpisodes);
      return { start, end };
    });
  }, [pageCount, episodesPerPage, totalEpisodes]);

  const categories = useMemo(() => {
    return categoriesAsc.map(({ start, end }) => `${start}-${end}`);
  }, [categoriesAsc]);

  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [isCategoryHovered, setIsCategoryHovered] = useState(false);

  const preventPageScroll = useCallback(
    (e: WheelEvent) => {
      if (isCategoryHovered) e.preventDefault();
    },
    [isCategoryHovered],
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (isCategoryHovered && categoryContainerRef.current) {
        e.preventDefault();
        categoryContainerRef.current.scrollBy({
          left: e.deltaY * 2,
          behavior: 'smooth',
        });
      }
    },
    [isCategoryHovered],
  );

  useEffect(() => {
    if (isCategoryHovered) {
      document.addEventListener('wheel', preventPageScroll, { passive: false });
      document.addEventListener('wheel', handleWheel, { passive: false });
    } else {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    }
    return () => {
      document.removeEventListener('wheel', preventPageScroll);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [isCategoryHovered, preventPageScroll, handleWheel]);

  useEffect(() => {
    const btn = buttonRefs.current[currentPage];
    const container = categoryContainerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const btnLeft = btnRect.left - containerRect.left + scrollLeft;
      const targetScrollLeft =
        btnLeft - (containerRect.width - btnRect.width) / 2;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [currentPage, pageCount]);

  const handleCategoryClick = useCallback((index: number) => {
    setCurrentPage(index);
  }, []);

  const currentStart = currentPage * episodesPerPage + 1;
  const currentEnd = Math.min(
    currentStart + episodesPerPage - 1,
    totalEpisodes,
  );

  return (
    <>
      {/* 工具栏：分页标签 */}
      <div className='flex items-center gap-2 px-5 sm:px-6 py-3 flex-shrink-0'>
        {/* 分页标签（仅多页时显示） */}
        {pageCount > 1 && (
          <div
            className='flex-1 overflow-x-auto'
            ref={categoryContainerRef}
            onMouseEnter={() => setIsCategoryHovered(true)}
            onMouseLeave={() => setIsCategoryHovered(false)}
          >
            <div className='flex gap-1 w-max min-w-full justify-center'>
              {categories.map((label, idx) => {
                const isActive = idx === currentPage;
                return (
                  <button
                    key={label}
                    ref={(el) => {
                      buttonRefs.current[idx] = el;
                    }}
                    onClick={() => handleCategoryClick(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap
                      ${
                        isActive
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200'
                      }
                    `.trim()}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* 单页时显示集数范围 */}
        {pageCount <= 1 && (
          <span className='flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 text-center'>
            1-{totalEpisodes}
          </span>
        )}
      </div>

      {/* 分割线：更柔和、左右留白 */}
      <div className='mx-5 sm:mx-6 h-px bg-gradient-to-r from-transparent via-gray-200/80 to-transparent dark:via-white/[0.10]' />

      {/* 集数网格 */}
      <div className='grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 overflow-y-auto flex-1 content-start p-5 sm:p-6'>
        {(() => {
          const len = currentEnd - currentStart + 1;
          return Array.from({ length: len }, (_, i) => currentStart + i);
        })().map((episodeNumber) => {
          const isActive = episodeNumber === value;
          const rawTitle = episodes_titles?.[episodeNumber - 1];
          const match = rawTitle?.match(/(?:第)?(\d+)(?:集|话)/);
          const displayTitle = rawTitle
            ? match
              ? match[1]
              : rawTitle
            : `${episodeNumber}`;
          const isNumericLabel = /^\d+$/.test(displayTitle);
          // 基于像素估算：CJK ≈ 13px，Latin ≈ 7.5px，按钮 px-2 内边距 16px
          // 列宽 3rem(48px) + gap-2(8px)，span N 可用文本宽度 ≈ 56N - 24
          const estimatedPx = Array.from(displayTitle).reduce(
            (sum, char) =>
              sum +
              (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)
                ? 13
                : 7.5),
            0,
          );
          const dynamicSpan = Math.max(
            1,
            Math.min(3, Math.ceil((estimatedPx + 24) / 56)),
          );
          return (
            <button
              key={episodeNumber}
              onClick={() => onChange?.(episodeNumber - 1)}
              style={
                dynamicSpan > 1
                  ? {
                      gridColumn: `span ${dynamicSpan} / span ${dynamicSpan}`,
                    }
                  : undefined
              }
              className={`h-11 ${dynamicSpan > 1 ? 'px-2' : 'px-1'} flex items-center justify-center text-[13px] rounded-lg transition-all duration-150 min-w-0 font-medium
                ${
                  isActive
                    ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.12] hover:scale-105'
                }`.trim()}
              title={rawTitle || `第 ${episodeNumber} 集`}
            >
              <span className='truncate'>{displayTitle}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
