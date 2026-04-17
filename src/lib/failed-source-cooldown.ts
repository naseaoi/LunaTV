/**
 * 源站短期失败冷却：把近期 15s 加载超时的源记录在 sessionStorage 里，
 * 在 SourcesTab 的排序里降权，减少用户反复踩坑的概率。
 *
 * 规则：
 * - 冷却时长 5 分钟；超过后自动恢复
 * - 用户主动点击失败源 → 手动清除该源的冷却记录（尊重用户意图）
 * - 成功起播 → 清除该源的冷却记录
 * - 使用 sessionStorage：tab 关闭后自动消失，避免把过期 token 问题带到下次会话
 */
const STORAGE_KEY = 'icetv_failed_sources';
const COOLDOWN_MS = 5 * 60 * 1000;

type FailedRecord = Record<string, number>;

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

function readAll(): FailedRecord {
  if (!isStorageAvailable()) return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: FailedRecord): void {
  if (!isStorageAvailable()) return;
  try {
    // 写入前顺手清理已过期的条目，控制体积
    const now = Date.now();
    for (const key of Object.keys(data)) {
      if (now - data[key] > COOLDOWN_MS) {
        delete data[key];
      }
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量/隐私模式下写失败时静默忽略
  }
}

/** 记录一次源站加载超时，开始 5 分钟冷却 */
export function markSourceFailed(key: string): void {
  if (!key) return;
  const data = readAll();
  data[key] = Date.now();
  writeAll(data);
}

/** 检查源站是否处于冷却期（true 表示近期失败，应在排序里降权） */
export function isSourceCoolingDown(key: string): boolean {
  if (!key) return false;
  const data = readAll();
  const ts = data[key];
  if (!ts) return false;
  if (Date.now() - ts > COOLDOWN_MS) {
    // 过期，顺手清理
    delete data[key];
    writeAll(data);
    return false;
  }
  return true;
}

/** 手动清除某个源的冷却记录（用户主动点击/成功起播时调用） */
export function clearSourceFailure(key: string): void {
  if (!key) return;
  const data = readAll();
  if (data[key] !== undefined) {
    delete data[key];
    writeAll(data);
  }
}
