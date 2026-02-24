import { MutableRefObject, useEffect, useRef } from 'react';

import { Radio, Tv } from 'lucide-react';

import type { LiveChannel, LiveSource } from '../types';

interface LiveChannelSidebarProps {
  activeTab: 'channels' | 'sources';
  setActiveTab: (tab: 'channels' | 'sources') => void;
  isChannelListCollapsed: boolean;
  isSwitchingSource: boolean;
  groupedChannels: Record<string, LiveChannel[]>;
  selectedGroup: string;
  filteredChannels: LiveChannel[];
  currentChannel: LiveChannel | null;
  currentSource: LiveSource | null;
  liveSources: LiveSource[];
  groupContainerRef: MutableRefObject<HTMLDivElement | null>;
  channelListRef: MutableRefObject<HTMLDivElement | null>;
  handleGroupChange: (group: string) => void;
  handleChannelChange: (channel: LiveChannel) => void;
  handleSourceChange: (source: LiveSource) => void;
}

export function LiveChannelSidebar({
  activeTab,
  setActiveTab,
  isChannelListCollapsed,
  isSwitchingSource,
  groupedChannels,
  selectedGroup,
  filteredChannels,
  currentChannel,
  currentSource,
  liveSources,
  groupContainerRef,
  channelListRef,
  handleGroupChange,
  handleChannelChange,
  handleSourceChange,
}: LiveChannelSidebarProps) {
  // 分组标签滚动
  const groupButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!selectedGroup || !groupContainerRef.current) return;

    const groupKeys = Object.keys(groupedChannels);
    const groupIndex = groupKeys.indexOf(selectedGroup);
    if (groupIndex === -1) return;

    const btn = groupButtonRefs.current[groupIndex];
    const container = groupContainerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;
      const btnLeft = btnRect.left - containerRect.left + scrollLeft;
      const btnWidth = btnRect.width;
      const containerWidth = containerRect.width;
      const targetScrollLeft = btnLeft - (containerWidth - btnWidth) / 2;
      container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
  }, [selectedGroup, groupedChannels, groupContainerRef]);

  return (
    <div
      className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${
        isChannelListCollapsed
          ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
          : 'md:col-span-1 lg:opacity-100 lg:scale-100'
      }`}
    >
      <div className='md:ml-2 px-4 py-0 h-full rounded-xl bg-black/10 dark:bg-white/5 flex flex-col border border-white/0 dark:border-white/30 overflow-hidden'>
        {/* 主要的 Tab 切换 */}
        <div className='flex mb-1 -mx-6 flex-shrink-0'>
          <div
            onClick={() => setActiveTab('channels')}
            className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium
              ${
                activeTab === 'channels'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'
              }
            `.trim()}
          >
            频道
          </div>
          <div
            onClick={() => setActiveTab('sources')}
            className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium
              ${
                activeTab === 'sources'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'
              }
            `.trim()}
          >
            直播源
          </div>
        </div>

        {/* 频道 Tab 内容 */}
        {activeTab === 'channels' && (
          <>
            {/* 分组标签 */}
            <div className='flex items-center gap-4 mb-4 border-b border-gray-300 dark:border-gray-700 -mx-6 px-6 flex-shrink-0'>
              {isSwitchingSource && (
                <div className='flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400'>
                  <div className='w-2 h-2 bg-amber-500 rounded-full animate-pulse'></div>
                  切换直播源中...
                </div>
              )}

              <div
                className='flex-1 overflow-x-auto'
                ref={groupContainerRef}
                onMouseEnter={() => {
                  const container = groupContainerRef.current;
                  if (container) {
                    const handleWheel = (e: WheelEvent) => {
                      if (container.scrollWidth > container.clientWidth) {
                        e.preventDefault();
                        container.scrollLeft += e.deltaY;
                      }
                    };
                    container.addEventListener('wheel', handleWheel, {
                      passive: false,
                    });

                    (container as any)._wheelHandler = handleWheel;
                  }
                }}
                onMouseLeave={() => {
                  const container = groupContainerRef.current;

                  if (container && (container as any)._wheelHandler) {
                    container.removeEventListener(
                      'wheel',

                      (container as any)._wheelHandler,
                    );

                    delete (container as any)._wheelHandler;
                  }
                }}
              >
                <div className='flex gap-4 min-w-max'>
                  {Object.keys(groupedChannels).map((group, index) => (
                    <button
                      key={group}
                      data-group={group}
                      ref={(el) => {
                        groupButtonRefs.current[index] = el;
                      }}
                      onClick={() => handleGroupChange(group)}
                      disabled={isSwitchingSource}
                      className={`w-20 relative py-2 text-sm font-medium transition-colors flex-shrink-0 text-center overflow-hidden
                         ${
                           isSwitchingSource
                             ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                             : selectedGroup === group
                               ? 'text-green-500 dark:text-green-400'
                               : 'text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400'
                         }
                       `.trim()}
                    >
                      <div
                        className='px-1 overflow-hidden whitespace-nowrap'
                        title={group}
                      >
                        {group}
                      </div>
                      {selectedGroup === group && !isSwitchingSource && (
                        <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 dark:bg-green-400' />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 频道列表 */}
            <div
              ref={channelListRef}
              className='flex-1 overflow-y-auto space-y-2 pb-4'
            >
              {filteredChannels.length > 0 ? (
                filteredChannels.map((channel) => {
                  const isActive = channel.id === currentChannel?.id;
                  return (
                    <button
                      key={channel.id}
                      data-channel-id={channel.id}
                      onClick={() => handleChannelChange(channel)}
                      disabled={isSwitchingSource}
                      className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${
                        isSwitchingSource
                          ? 'opacity-50 cursor-not-allowed'
                          : isActive
                            ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                          {channel.logo ? (
                            <img
                              src={`/api/proxy/logo?url=${encodeURIComponent(channel.logo)}&source=${currentSource?.key || ''}`}
                              alt={channel.name}
                              className='w-full h-full rounded object-contain'
                              loading='lazy'
                            />
                          ) : (
                            <Tv className='w-5 h-5 text-gray-500' />
                          )}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div
                            className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'
                            title={channel.name}
                          >
                            {channel.name}
                          </div>
                          <div
                            className='text-xs text-gray-500 dark:text-gray-400 mt-1'
                            title={channel.group}
                          >
                            {channel.group}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                    <Tv className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 font-medium'>
                    暂无可用频道
                  </p>
                  <p className='text-sm text-gray-400 dark:text-gray-500 mt-1'>
                    请选择其他直播源或稍后再试
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* 直播源 Tab 内容 */}
        {activeTab === 'sources' && (
          <div className='flex flex-col h-full mt-4'>
            <div className='flex-1 overflow-y-auto space-y-2 pb-20'>
              {liveSources.length > 0 ? (
                liveSources.map((source) => {
                  const isCurrentSource = source.key === currentSource?.key;
                  return (
                    <div
                      key={source.key}
                      onClick={() =>
                        !isCurrentSource && handleSourceChange(source)
                      }
                      className={`flex items-start gap-3 px-2 py-3 rounded-lg transition-all select-none duration-200 relative
                        ${
                          isCurrentSource
                            ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30 border'
                            : 'hover:bg-gray-200/50 dark:hover:bg-white/10 hover:scale-[1.02] cursor-pointer'
                        }`.trim()}
                    >
                      <div className='w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0'>
                        <Radio className='w-6 h-6 text-gray-500' />
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                          {source.name}
                        </div>
                        <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                          {!source.channelNumber || source.channelNumber === 0
                            ? '-'
                            : `${source.channelNumber} 个频道`}
                        </div>
                      </div>
                      {isCurrentSource && (
                        <div className='absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full'></div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                    <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                  </div>
                  <p className='text-gray-500 dark:text-gray-400 font-medium'>
                    暂无可用直播源
                  </p>
                  <p className='text-sm text-gray-400 dark:text-gray-500 mt-1'>
                    请检查网络连接或联系管理员添加直播源
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
