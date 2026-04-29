import type { ResumeMode } from '@/features/play/lib/resumePlayback';

export interface SourceSwitchResumeState {
  resumeTime: number;
  resumeMode: ResumeMode;
}

interface ResolveSourceSwitchResumeStateOptions {
  currentPlayTime: number;
  preserveProgress: boolean;
  clearTargetEpisodeProgress: boolean;
}

interface ResolveSourceSwitchCurrentPlayTimeOptions {
  playerCurrentTime: number;
  pendingResumeTime: number | null;
}

/**
 * 自动换源优先采用播放器里的稳定进度；
 * 若当前仅有零点几秒的探测值，则回退到待恢复的有效进度。
 */
export function resolveSourceSwitchCurrentPlayTime({
  playerCurrentTime,
  pendingResumeTime,
}: ResolveSourceSwitchCurrentPlayTimeOptions): number {
  if (playerCurrentTime > 1) {
    return playerCurrentTime;
  }

  return pendingResumeTime && pendingResumeTime > 0 ? pendingResumeTime : 0;
}

/**
 * 换源本身就是一次显式的目标集选择：
 * - 有有效进度时沿用当前集进度
 * - 否则强制从目标集开头起播，并阻止目标源旧历史反向覆盖
 */
export function resolveSourceSwitchResumeState({
  currentPlayTime,
  preserveProgress,
  clearTargetEpisodeProgress,
}: ResolveSourceSwitchResumeStateOptions): SourceSwitchResumeState {
  if (clearTargetEpisodeProgress) {
    return { resumeTime: 0, resumeMode: 'forced' };
  }

  if (preserveProgress && currentPlayTime > 1) {
    return {
      resumeTime: currentPlayTime,
      resumeMode: 'forced',
    };
  }

  return { resumeTime: 0, resumeMode: 'forced' };
}
