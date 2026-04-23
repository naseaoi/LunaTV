import {
  resolveSourceSwitchCurrentPlayTime,
  resolveSourceSwitchResumeState,
} from '@/features/play/lib/episodeResumePolicy';

describe('episodeResumePolicy', () => {
  it('自动换源时优先采用播放器里的稳定进度', () => {
    expect(
      resolveSourceSwitchCurrentPlayTime({
        playerCurrentTime: 12.8,
        pendingResumeTime: 1320,
      }),
    ).toBe(12.8);
  });

  it('播放器进度只有零点几秒时回退到待恢复进度', () => {
    expect(
      resolveSourceSwitchCurrentPlayTime({
        playerCurrentTime: 0.4,
        pendingResumeTime: 1320,
      }),
    ).toBe(1320);
  });

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
