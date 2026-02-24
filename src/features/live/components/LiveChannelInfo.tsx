import { Heart, Tv } from 'lucide-react';

import EpgScrollableRow from '@/components/EpgScrollableRow';

import type { EpgData, LiveChannel, LiveSource } from '../types';

// FavoriteIcon 组件
function FavoriteIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        className='h-6 w-6'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='#ef4444'
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return (
    <Heart className='h-6 w-6 stroke-[1] text-gray-600 dark:text-gray-300' />
  );
}

interface LiveChannelInfoProps {
  currentChannel: LiveChannel;
  currentSource: LiveSource | null;
  favorited: boolean;
  handleToggleFavorite: () => void;
  epgData: EpgData | null;
  isEpgLoading: boolean;
}

export function LiveChannelInfo({
  currentChannel,
  currentSource,
  favorited,
  handleToggleFavorite,
  epgData,
  isEpgLoading,
}: LiveChannelInfoProps) {
  return (
    <div className='pt-4'>
      <div className='flex flex-col lg:flex-row gap-4'>
        <div className='w-full flex-shrink-0'>
          <div className='flex items-center gap-4'>
            <div className='w-20 h-20 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
              {currentChannel.logo ? (
                <img
                  src={`/api/proxy/logo?url=${encodeURIComponent(currentChannel.logo)}&source=${currentSource?.key || ''}`}
                  alt={currentChannel.name}
                  className='w-full h-full rounded object-contain'
                  loading='lazy'
                />
              ) : (
                <Tv className='w-10 h-10 text-gray-500' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-3'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 truncate'>
                  {currentChannel.name}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite();
                  }}
                  className='flex-shrink-0 hover:opacity-80 transition-opacity'
                  title={favorited ? '取消收藏' : '收藏'}
                >
                  <FavoriteIcon filled={favorited} />
                </button>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400 truncate'>
                {currentSource?.name} {' > '} {currentChannel.group}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* EPG节目单 */}
      <EpgScrollableRow
        programs={epgData?.programs || []}
        currentTime={new Date()}
        isLoading={isEpgLoading}
      />
    </div>
  );
}
