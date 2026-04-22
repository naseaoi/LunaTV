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
