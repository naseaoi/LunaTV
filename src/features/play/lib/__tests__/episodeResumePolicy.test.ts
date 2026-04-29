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
        stableCurrentTime: 10,
      }),
    ).toBe(12.8);
  });

  it('播放器进度只有零点几秒时回退到待恢复进度', () => {
    expect(
      resolveSourceSwitchCurrentPlayTime({
        playerCurrentTime: 0.4,
        pendingResumeTime: 1320,
        stableCurrentTime: 0,
      }),
    ).toBe(1320);
  });

  it('播放器和待恢复进度都无效时回退到 stableCurrentTime', () => {
    expect(
      resolveSourceSwitchCurrentPlayTime({
        playerCurrentTime: 0.2,
        pendingResumeTime: null,
        stableCurrentTime: 900,
      }),
    ).toBe(900);
  });

  it('三者都无效时返回 0', () => {
    expect(
      resolveSourceSwitchCurrentPlayTime({
        playerCurrentTime: 0,
        pendingResumeTime: null,
        stableCurrentTime: 0,
      }),
    ).toBe(0);
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
      resumeMode: 'forced',
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

  it('无有效进度时会强制从目标集开头起播', () => {
    expect(
      resolveSourceSwitchResumeState({
        currentPlayTime: 1,
        preserveProgress: true,
        clearTargetEpisodeProgress: false,
      }),
    ).toEqual({
      resumeTime: 0,
      resumeMode: 'forced',
    });
  });
});
