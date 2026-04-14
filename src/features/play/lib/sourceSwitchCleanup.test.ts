import {
  finalizeSourceSwitchCleanup,
  shouldFinalizeSourceSwitchCleanup,
  type SourceSwitchCleanupTask,
} from '@/features/play/lib/sourceSwitchCleanup';

describe('sourceSwitchCleanup', () => {
  const task: SourceSwitchCleanupTask = {
    previousSource: 'source-a',
    previousId: 'id-a',
    nextSource: 'source-b',
    nextId: 'id-b',
    previousSkipConfig: {
      enable: true,
      intro_time: 12,
      outro_time: -18,
    },
  };

  it('仅在目标源真正成为当前源后才允许清理旧记录', () => {
    expect(shouldFinalizeSourceSwitchCleanup(task, 'source-a', 'id-a')).toBe(
      false,
    );
    expect(shouldFinalizeSourceSwitchCleanup(task, 'source-b', 'id-b')).toBe(
      true,
    );
  });

  it('在新源开始播放后再删除旧记录并迁移跳过配置', async () => {
    const deletePlayRecord = jest.fn().mockResolvedValue(undefined);
    const deleteSkipConfig = jest.fn().mockResolvedValue(undefined);
    const saveSkipConfig = jest.fn().mockResolvedValue(undefined);

    await finalizeSourceSwitchCleanup(task, {
      deletePlayRecord,
      deleteSkipConfig,
      saveSkipConfig,
    });

    expect(deletePlayRecord).toHaveBeenCalledWith('source-a', 'id-a');
    expect(deleteSkipConfig).toHaveBeenCalledWith('source-a', 'id-a');
    expect(saveSkipConfig).toHaveBeenCalledWith('source-b', 'id-b', {
      enable: true,
      intro_time: 12,
      outro_time: -18,
    });
  });
});
