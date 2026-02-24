import { MutableRefObject, useEffect } from 'react';

import Artplayer from 'artplayer';

import { SearchResult } from '@/lib/types';

interface UseKeyboardShortcutsParams {
  artPlayerRef: MutableRefObject<Artplayer | null>;
  detailRef: MutableRefObject<SearchResult | null>;
  currentEpisodeIndexRef: MutableRefObject<number>;
  handlePreviousEpisode: () => void;
  handleNextEpisode: () => void;
}

export function useKeyboardShortcuts({
  artPlayerRef,
  detailRef,
  currentEpisodeIndexRef,
  handlePreviousEpisode,
  handleNextEpisode,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // 忽略输入框中的按键事件
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      )
        return;

      // Alt + 左箭头 = 上一集
      if (e.altKey && e.key === 'ArrowLeft') {
        if (detailRef.current && currentEpisodeIndexRef.current > 0) {
          handlePreviousEpisode();
          e.preventDefault();
        }
      }

      // Alt + 右箭头 = 下一集
      if (e.altKey && e.key === 'ArrowRight') {
        const d = detailRef.current;
        const idx = currentEpisodeIndexRef.current;
        if (d && idx < d.episodes.length - 1) {
          handleNextEpisode();
          e.preventDefault();
        }
      }

      // 左箭头 = 快退
      if (!e.altKey && e.key === 'ArrowLeft') {
        if (artPlayerRef.current && artPlayerRef.current.currentTime > 5) {
          artPlayerRef.current.currentTime -= 10;
          e.preventDefault();
        }
      }

      // 右箭头 = 快进
      if (!e.altKey && e.key === 'ArrowRight') {
        if (
          artPlayerRef.current &&
          artPlayerRef.current.currentTime < artPlayerRef.current.duration - 5
        ) {
          artPlayerRef.current.currentTime += 10;
          e.preventDefault();
        }
      }

      // 上箭头 = 音量+
      if (e.key === 'ArrowUp') {
        if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
          artPlayerRef.current.volume =
            Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
          artPlayerRef.current.notice.show = `音量: ${Math.round(
            artPlayerRef.current.volume * 100,
          )}`;
          e.preventDefault();
        }
      }

      // 下箭头 = 音量-
      if (e.key === 'ArrowDown') {
        if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
          artPlayerRef.current.volume =
            Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
          artPlayerRef.current.notice.show = `音量: ${Math.round(
            artPlayerRef.current.volume * 100,
          )}`;
          e.preventDefault();
        }
      }

      // 空格 = 播放/暂停
      if (e.key === ' ') {
        if (artPlayerRef.current) {
          artPlayerRef.current.toggle();
          e.preventDefault();
        }
      }

      // f 键 = 切换全屏
      if (e.key === 'f' || e.key === 'F') {
        if (artPlayerRef.current) {
          artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [
    artPlayerRef,
    detailRef,
    currentEpisodeIndexRef,
    handlePreviousEpisode,
    handleNextEpisode,
  ]);
}
