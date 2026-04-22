import { resolveSourceSwitchResumeState } from '@/features/play/lib/episodeResumePolicy';

describe('episodeResumePolicy', () => {
  it('切集后的自动换源不会继承上一集进度', () => {
    expect(
      resolveSourceSwitchResumeState({
        currentPlayTime: 1320,
        preserveProgress: true,
        clearTargetEpisodeProgress: true,
      }),
    ).toEqual({
      resumeTime: 0,
      resumeMode: null,
    });
  });

  it('普通换源仍会保留当前集进度', () => {
    expect(
      resolveSourceSwitchResumeState({
        currentPlayTime: 1320,
        preserveProgress: true,
        clearTargetEpisodeProgress: false,
      }),
    ).toEqual({
      resumeTime: 1320,
      resumeMode: 'forced',
    });
  });

  it('无有效进度时不会触发恢复', () => {
    expect(
      resolveSourceSwitchResumeState({
        currentPlayTime: 1,
        preserveProgress: true,
        clearTargetEpisodeProgress: false,
      }),
    ).toEqual({
      resumeTime: 0,
      resumeMode: null,
    });
  });
});
