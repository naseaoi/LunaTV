import {
  resolveProtectedPlaybackTime,
  resolvePlaybackRestoreCandidate,
  shouldApplyHistoryRestore,
} from '@/features/play/hooks/usePlayProgress';

describe('usePlayProgress helpers', () => {
  it('异步历史读取不会覆盖已存在的 forced 恢复点', () => {
    expect(
      shouldApplyHistoryRestore({
        requestedSource: 'source-a',
        requestedId: 'id-a',
        requestedEpisodeIndex: 2,
        activeSource: 'source-a',
        activeId: 'id-a',
        activeEpisodeIndex: 2,
        allowAutoResume: true,
        pendingResumeTime: 456,
        pendingResumeMode: 'forced',
      }),
    ).toBe(false);
  });

  it('异步历史读取应用前会校验 source/id/episode 快照', () => {
    expect(
      shouldApplyHistoryRestore({
        requestedSource: 'source-a',
        requestedId: 'id-a',
        requestedEpisodeIndex: 2,
        activeSource: 'source-a',
        activeId: 'id-a',
        activeEpisodeIndex: 3,
        allowAutoResume: true,
        pendingResumeTime: null,
        pendingResumeMode: null,
      }),
    ).toBe(false);
  });

  it('快照一致且不存在 forced 恢复点时允许应用历史', () => {
    expect(
      shouldApplyHistoryRestore({
        requestedSource: 'source-a',
        requestedId: 'id-a',
        requestedEpisodeIndex: 2,
        activeSource: 'source-a',
        activeId: 'id-a',
        activeEpisodeIndex: 2,
        allowAutoResume: true,
        pendingResumeTime: 456,
        pendingResumeMode: 'history',
      }),
    ).toBe(true);
  });

  it('首页记录比 checkpoint 更新时优先使用首页记录', () => {
    expect(
      resolvePlaybackRestoreCandidate({
        checkpoint: {
          source: 'source-a',
          id: 'id-a',
          episodeIndex: 7,
          currentTime: 1320,
          title: '番剧A',
          saveTime: 1000,
        },
        record: {
          title: '番剧A',
          source_name: '源A',
          year: '2024',
          cover: '',
          index: 8,
          total_episodes: 12,
          play_time: 180,
          total_time: 1500,
          save_time: 2000,
        },
        episodeCount: 12,
      }),
    ).toEqual({
      source: 'history',
      episodeIndex: 7,
      resumeTime: 180,
      resumeMode: 'history',
    });
  });

  it('checkpoint 更新时比首页记录更新时优先使用 checkpoint', () => {
    expect(
      resolvePlaybackRestoreCandidate({
        checkpoint: {
          source: 'source-a',
          id: 'id-a',
          episodeIndex: 7,
          currentTime: 240,
          title: '番剧A',
          saveTime: 3000,
        },
        record: {
          title: '番剧A',
          source_name: '源A',
          year: '2024',
          cover: '',
          index: 8,
          total_episodes: 12,
          play_time: 180,
          total_time: 1500,
          save_time: 2000,
        },
        episodeCount: 12,
      }),
    ).toEqual({
      source: 'checkpoint',
      episodeIndex: 7,
      resumeTime: 240,
      resumeMode: 'forced',
    });
  });

  it('零进度 checkpoint 不会覆盖首页已有进度', () => {
    expect(
      resolvePlaybackRestoreCandidate({
        checkpoint: {
          source: 'source-a',
          id: 'id-a',
          episodeIndex: 7,
          currentTime: 0,
          title: '番剧A',
          saveTime: 3000,
        },
        record: {
          title: '番剧A',
          source_name: '源A',
          year: '2024',
          cover: '',
          index: 8,
          total_episodes: 12,
          play_time: 180,
          total_time: 1500,
          save_time: 2000,
        },
        episodeCount: 12,
      }),
    ).toEqual({
      source: 'history',
      episodeIndex: 7,
      resumeTime: 180,
      resumeMode: 'history',
    });
  });

  it('历史记录集数越界时会裁剪到当前可播放范围', () => {
    expect(
      resolvePlaybackRestoreCandidate({
        checkpoint: null,
        record: {
          title: '番剧A',
          source_name: '源A',
          year: '2024',
          cover: '',
          index: 99,
          total_episodes: 99,
          play_time: 180,
          total_time: 1500,
          save_time: 2000,
        },
        episodeCount: 12,
      }),
    ).toEqual({
      source: 'history',
      episodeIndex: 11,
      resumeTime: 180,
      resumeMode: 'history',
    });
  });

  it('保存进度时会优先使用播放器时间，否则回退到最近稳定进度', () => {
    expect(resolveProtectedPlaybackTime(331.8, 180)).toBe(331);
    expect(resolveProtectedPlaybackTime(0.2, 330)).toBe(330);
    expect(resolveProtectedPlaybackTime(0, 0)).toBe(0);
  });
});
