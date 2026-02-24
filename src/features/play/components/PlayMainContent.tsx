import {
  AlertTriangle,
  Cat,
  Clapperboard,
  Film,
  Play,
  RefreshCw,
  Tv,
} from 'lucide-react';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import EpisodeSelector from '@/components/EpisodeSelector';
import LoadingStatePanel from '@/components/LoadingStatePanel';
import PageLayout from '@/components/PageLayout';
import { SearchResult } from '@/lib/types';

interface PlayMainContentProps {
  videoTitle: string;
  totalEpisodes: number;
  detail: SearchResult | null;
  currentEpisodeIndex: number;
  isEpisodeSelectorCollapsed: boolean;
  setIsEpisodeSelectorCollapsed: (collapsed: boolean) => void;
  artRef: RefObject<HTMLDivElement>;
  isVideoLoading: boolean;
  videoLoadingStage: 'initing' | 'sourceChanging';
  realtimeLoadSpeed: string;
  authRecoveryVisible: boolean;
  authRecoveryReasonMessage: string;
  onReloginAndRecover: () => void;
  onDismissAuthRecovery: () => void;
  onEpisodeChange: (episodeNumber: number) => void;
  onSourceChange: (newSource: string, newId: string, newTitle: string) => void;
  currentSource: string;
  currentId: string;
  searchTitle: string;
  availableSources: SearchResult[];
  sourceSearchLoading: boolean;
  sourceSearchError: string | null;
  precomputedVideoInfo: Map<
    string,
    { quality: string; loadSpeed: string; pingTime: number }
  >;
  videoYear: string;
  favorited: boolean;
  onToggleFavorite: () => void;
  videoCover: string;
  videoDoubanId: number;
}

const TogglePanelButton = ({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className='group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-700 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 shadow-sm hover:shadow transition-all duration-200'
    title={collapsed ? '显示选集面板' : '隐藏选集面板'}
  >
    <svg
      className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
        collapsed ? 'rotate-180' : 'rotate-0'
      }`}
      fill='none'
      stroke='currentColor'
      viewBox='0 0 24 24'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M9 5l7 7-7 7'
      />
    </svg>
    <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
      {collapsed ? '显示' : '隐藏'}
    </span>
  </button>
);

export function PlayMainContent(props: PlayMainContentProps) {
  const {
    videoTitle,
    totalEpisodes,
    detail,
    currentEpisodeIndex,
    isEpisodeSelectorCollapsed,
    setIsEpisodeSelectorCollapsed,
    artRef,
    isVideoLoading,
    videoLoadingStage,
    realtimeLoadSpeed,
    authRecoveryVisible,
    authRecoveryReasonMessage,
    onReloginAndRecover,
    onDismissAuthRecovery,
    onEpisodeChange,
    onSourceChange,
    currentSource,
    currentId,
    searchTitle,
    availableSources,
    sourceSearchLoading,
    sourceSearchError,
    precomputedVideoInfo,
    videoYear,
    favorited,
    onToggleFavorite,
    videoCover,
    videoDoubanId,
  } = props;

  // 根据 detail.type_name 选择标题图标
  const TitleIcon = useMemo(() => {
    const typeName = detail?.type_name || '';
    if (/电影|Movie/i.test(typeName)) return Film;
    if (/电视|连续剧|TV|Drama/i.test(typeName)) return Tv;
    if (/动[漫画]|番[剧组]|Anime|OVA/i.test(typeName)) return Cat;
    if (/综艺|娱乐|Variety|Show/i.test(typeName)) return Clapperboard;
    // 兜底：根据集数推断
    if (totalEpisodes <= 1) return Film;
    return Play;
  }, [detail?.type_name, totalEpisodes]);

  // 锁定播放器高度：首次渲染后读取 16:9 容器的实际高度，
  // 之后固定为 px 值，切换面板时只改宽度不改高度。
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  const lockHeight = useCallback(() => {
    const el = playerWrapRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h > 0) setLockedHeight(h);
  }, []);

  // 首次布局完成后锁定；窗口 resize 时重新计算
  useEffect(() => {
    // 下一帧再读，确保浏览器已完成布局
    const raf = requestAnimationFrame(lockHeight);
    window.addEventListener('resize', lockHeight);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', lockHeight);
    };
  }, [lockHeight]);

  // 追踪是否为桌面端（md: 768px+），用于面板高度策略切换
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 视频加载超时检测（30秒）
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    if (!isVideoLoading) {
      setLoadingTimedOut(false);
      return;
    }
    setLoadingTimedOut(false);
    const timer = setTimeout(() => setLoadingTimedOut(true), 30_000);
    return () => clearTimeout(timer);
  }, [isVideoLoading, videoLoadingStage]);

  return (
    <PageLayout activePath='/play'>
      <div className='flex flex-col gap-4 py-4 px-4 sm:px-6 lg:px-[3rem] 2xl:px-20'>
        {/* 标题栏 + 折叠按钮 */}
        <div className='flex items-center relative'>
          {/* 标题居中于播放器区域 */}
          <div
            className={`transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex justify-center ${
              isEpisodeSelectorCollapsed ? 'w-full' : 'w-full md:w-3/4'
            }`}
          >
            <h1 className='flex items-center gap-3 text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 min-w-0'>
              <TitleIcon className='w-6 h-6 text-green-500 flex-shrink-0' />
              <span className='truncate max-w-[60vw] sm:max-w-[50vw]'>
                {videoTitle || '影片标题'}
              </span>
              {totalEpisodes > 1 && (
                <span className='text-sm font-medium text-gray-400 dark:text-gray-500 flex-shrink-0'>
                  {detail?.episodes_titles?.[currentEpisodeIndex] ||
                    `第 ${currentEpisodeIndex + 1} 集`}
                </span>
              )}
            </h1>
          </div>

          {/* 折叠/展开按钮 — 始终固定在右侧 */}
          <div className='hidden lg:block absolute right-0 top-1/2 -translate-y-1/2'>
            <TogglePanelButton
              collapsed={isEpisodeSelectorCollapsed}
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
            />
          </div>
        </div>

        {/* 播放器 + 选集面板 */}
        <div
          className={`grid ${
            isEpisodeSelectorCollapsed
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-4 gap-3'
          }`}
        >
          {/* 播放器 */}
          <div
            className={`rounded-xl overflow-hidden ${
              isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
            }`}
          >
            <div
              ref={playerWrapRef}
              className='relative w-full max-h-[80vh]'
              style={lockedHeight ? { height: `${lockedHeight}px` } : undefined}
            >
              {/* 未锁定高度前，用 aspect-video 撑出 16:9 初始高度 */}
              {!lockedHeight && <div className='w-full aspect-video' />}
              {/* 播放器绝对定位填满容器，高度锁定后不随宽度变化 */}
              <div className='absolute inset-0'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg ring-1 ring-black/10 dark:ring-white/10'
                ></div>

                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    {loadingTimedOut ? (
                      <LoadingStatePanel
                        compact
                        icon={<AlertTriangle className='w-9 h-9' />}
                        tone='red'
                        title={
                          videoLoadingStage === 'sourceChanging'
                            ? '切换播放源超时'
                            : '加载视频超时'
                        }
                        titleClassName='text-white'
                      >
                        <p className='text-sm text-gray-300 text-center mb-3'>
                          已等待超过 30 秒，可能是网络问题或播放源不可用
                        </p>
                        <button
                          onClick={() => window.location.reload()}
                          className='flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors'
                        >
                          <RefreshCw className='w-4 h-4' />
                          刷新页面重试
                        </button>
                      </LoadingStatePanel>
                    ) : (
                      <div className='flex flex-col items-center'>
                        {/* 复用全局 LoadingStatePanel 的 spinner 结构 */}
                        <div className='relative'>
                          <div className='player-ripple absolute -inset-4 rounded-full border border-emerald-300/40' />
                          <div className='player-ripple player-ripple-delay absolute -inset-4 rounded-full border border-emerald-300/40' />
                          <div className='player-spinner-shell relative z-[2] mx-auto h-20 w-20 sm:h-24 sm:w-24'>
                            <div className='player-ring-outer absolute inset-0 rounded-full border-2 border-transparent bg-gradient-to-r from-emerald-400/70 via-green-500/40 to-emerald-300/20' />
                            <div className='player-ring-inner absolute inset-[10px] rounded-full border border-white/30' />
                            <div className='absolute inset-[2px] rounded-full bg-transparent' />
                            <div className='player-orb absolute top-2 right-1 h-3 w-3 rounded-full bg-emerald-400/40' />
                          </div>
                        </div>
                        {videoLoadingStage === 'sourceChanging' && (
                          <div className='mt-3 text-xs font-medium text-white/50'>
                            切换中
                          </div>
                        )}

                        <style jsx>{`
                          .player-ripple {
                            animation: player-ripple 2.4s ease-out infinite;
                            transform-origin: center;
                          }
                          .player-ripple-delay {
                            animation-delay: 1.2s;
                          }
                          .player-spinner-shell {
                            filter: drop-shadow(0 8px 26px rgba(0, 0, 0, 0.12));
                          }
                          .player-ring-outer {
                            mask: radial-gradient(
                              circle,
                              transparent 58%,
                              black 59%
                            );
                            -webkit-mask: radial-gradient(
                              circle,
                              transparent 58%,
                              black 59%
                            );
                            animation: player-rotate 2.6s linear infinite;
                          }
                          .player-ring-inner {
                            animation: player-rotate-reverse 3.3s linear
                              infinite;
                          }
                          .player-orb {
                            animation: player-ping 1.8s ease-out infinite;
                          }
                          @keyframes player-rotate {
                            0% {
                              transform: rotate(0deg);
                            }
                            100% {
                              transform: rotate(360deg);
                            }
                          }
                          @keyframes player-rotate-reverse {
                            0% {
                              transform: rotate(0deg);
                            }
                            100% {
                              transform: rotate(-360deg);
                            }
                          }
                          @keyframes player-ripple {
                            0% {
                              transform: scale(0.92);
                              opacity: 0.45;
                            }
                            70% {
                              transform: scale(1.2);
                              opacity: 0;
                            }
                            100% {
                              transform: scale(1.2);
                              opacity: 0;
                            }
                          }
                          @keyframes player-ping {
                            0% {
                              transform: scale(0.9);
                              opacity: 0.65;
                            }
                            70% {
                              transform: scale(1.9);
                              opacity: 0;
                            }
                            100% {
                              transform: scale(1.9);
                              opacity: 0;
                            }
                          }
                        `}</style>
                      </div>
                    )}
                  </div>
                )}

                {authRecoveryVisible && (
                  <div className='absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-[520]'>
                    <div className='w-full max-w-md mx-4 bg-zinc-900/95 border border-zinc-700 rounded-2xl shadow-2xl p-6 text-center'>
                      <div className='text-4xl mb-3'>🔐</div>
                      <h3 className='text-lg font-semibold text-white mb-2'>
                        登录状态异常
                      </h3>
                      <p className='text-sm text-zinc-300 leading-6 mb-5'>
                        {authRecoveryReasonMessage}
                      </p>
                      <div className='space-y-2'>
                        <button
                          onClick={onReloginAndRecover}
                          className='w-full px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors'
                        >
                          去登录并恢复播放
                        </button>
                        <button
                          onClick={onDismissAuthRecovery}
                          className='w-full px-4 py-2.5 rounded-lg bg-zinc-700 text-zinc-200 font-medium hover:bg-zinc-600 transition-colors'
                        >
                          稍后处理
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 选集面板 */}
          <div
            className={`overflow-hidden ${
              isEpisodeSelectorCollapsed
                ? 'h-0 md:col-span-1 lg:max-w-0 lg:opacity-0 lg:pointer-events-none'
                : 'md:col-span-1 lg:max-w-[100%] lg:opacity-100'
            }`}
            style={
              isEpisodeSelectorCollapsed
                ? undefined
                : lockedHeight
                  ? isDesktop
                    ? { height: `${lockedHeight}px` }
                    : {
                        height: `calc(100dvh - ${lockedHeight}px - 13.5rem - env(safe-area-inset-bottom, 0px))`,
                      }
                  : { height: '300px' }
            }
          >
            <EpisodeSelector
              totalEpisodes={totalEpisodes}
              episodes_titles={detail?.episodes_titles || []}
              value={currentEpisodeIndex + 1}
              onChange={onEpisodeChange}
              onSourceChange={onSourceChange}
              currentSource={currentSource}
              currentId={currentId}
              videoTitle={searchTitle || videoTitle}
              availableSources={availableSources}
              sourceSearchLoading={sourceSearchLoading}
              sourceSearchError={sourceSearchError}
              precomputedVideoInfo={precomputedVideoInfo}
              detail={detail}
              videoYear={videoYear}
              favorited={favorited}
              onToggleFavorite={onToggleFavorite}
              videoCover={videoCover}
              videoDoubanId={videoDoubanId}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
