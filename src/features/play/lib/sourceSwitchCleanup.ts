import type { SkipConfig } from '@/lib/types';

export interface SourceSwitchCleanupTask {
  previousSource: string;
  previousId: string;
  nextSource: string;
  nextId: string;
  previousSkipConfig: SkipConfig;
  keepPreviousPlayRecord?: boolean;
}

interface SourceSwitchCleanupDeps {
  deletePlayRecord: (source: string, id: string) => Promise<void>;
  deleteSkipConfig: (source: string, id: string) => Promise<void>;
  saveSkipConfig: (
    source: string,
    id: string,
    config: SkipConfig,
  ) => Promise<void>;
}

/**
 * 只有新源真正成为当前播放源后，才允许清理旧记录，
 * 避免在加载失败或中途返回时把首页的继续观看记录提前删掉。
 */
export function shouldFinalizeSourceSwitchCleanup(
  task: SourceSwitchCleanupTask | null,
  activeSource: string,
  activeId: string,
): task is SourceSwitchCleanupTask {
  if (!task) {
    return false;
  }

  return task.nextSource === activeSource && task.nextId === activeId;
}

/**
 * 新源开始播放后，再补做旧记录删除和跳过配置迁移。
 */
export async function finalizeSourceSwitchCleanup(
  task: SourceSwitchCleanupTask,
  deps: SourceSwitchCleanupDeps,
) {
  if (!task.keepPreviousPlayRecord) {
    try {
      await deps.deletePlayRecord(task.previousSource, task.previousId);
    } catch (err) {
      console.error('清除播放记录失败:', err);
    }
  }

  try {
    await deps.deleteSkipConfig(task.previousSource, task.previousId);
    await deps.saveSkipConfig(
      task.nextSource,
      task.nextId,
      task.previousSkipConfig,
    );
  } catch (err) {
    console.error('迁移跳过片头片尾配置失败:', err);
  }
}
