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
 * 切集后的换源只负责对齐目标集数，不继承上一集的播放时间。
 */
export function resolveSourceSwitchResumeState({
  currentPlayTime,
  preserveProgress,
  clearTargetEpisodeProgress,
}: ResolveSourceSwitchResumeStateOptions): SourceSwitchResumeState {
  if (clearTargetEpisodeProgress) {
    return { resumeTime: 0, resumeMode: null };
  }

  if (preserveProgress && currentPlayTime > 1) {
    return {
      resumeTime: currentPlayTime,
      resumeMode: 'forced',
    };
  }

  return { resumeTime: 0, resumeMode: null };
}
