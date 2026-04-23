import { shouldApplyHistoryRestore } from '@/features/play/hooks/usePlayProgress';

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
});
