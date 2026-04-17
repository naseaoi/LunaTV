/**
 * 服务端内存缓存（SWR 软过期 + 请求去重 + LRU）
 *
 * 适用：单实例部署下，对只读、幂等、回源成本高的接口做进程级缓存，
 * 抑制相同 key 的并发雷群（thundering herd）、降低冷数据回源压力。
 *
 * 不适用：多实例/Serverless 冷启动高频场景（需外置到 Redis/KV）。
 */

// 单条缓存条目
interface Entry<T> {
  value: T;
  // 新鲜截止：小于此时间命中为 fresh，直接返回
  freshUntil: number;
  // 软过期截止：freshUntil~staleUntil 之间命中返回旧值并后台刷新
  staleUntil: number;
}

// 构造参数
export interface SwrCacheOptions {
  // 命名空间（用于区分不同缓存实例的日志/调试）
  name: string;
  // 最大条目数，溢出按 LRU（最早过期时间）淘汰
  maxSize?: number;
  // 新鲜期毫秒：期内命中直接返回
  freshMs: number;
  // 软过期毫秒：freshUntil 之后再经过 staleMs 才彻底失效；期间命中会触发后台刷新
  staleMs?: number;
}

/**
 * 创建一个 SWR 缓存实例。调用方通过 `getOrLoad(key, loader)` 使用。
 */
export function createSwrCache<T>(opts: SwrCacheOptions) {
  const { name, freshMs, staleMs = freshMs, maxSize = 1000 } = opts;
  const store = new Map<string, Entry<T>>();
  // 正在进行的回源请求，用于同 key 请求合并
  const inflight = new Map<string, Promise<T>>();

  // 溢出时按 staleUntil 升序淘汰最老条目
  function evictIfNeeded() {
    if (store.size <= maxSize) return;
    const toRemove = store.size - maxSize;
    const entries = Array.from(store.entries()).sort(
      (a, b) => a[1].staleUntil - b[1].staleUntil,
    );
    for (let i = 0; i < toRemove; i++) store.delete(entries[i][0]);
  }

  // 真正执行 loader，带请求合并
  function load(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key);
    if (existing) return existing;
    const p = loader()
      .then((value) => {
        const now = Date.now();
        store.set(key, {
          value,
          freshUntil: now + freshMs,
          staleUntil: now + freshMs + staleMs,
        });
        evictIfNeeded();
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, p);
    return p;
  }

  return {
    name,
    /**
     * 读取或加载：
     * - fresh 命中：直接返回
     * - stale 命中：立即返回旧值，后台刷新
     * - miss：回源并等待结果（同 key 并发自动合并）
     */
    async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const hit = store.get(key);
      if (hit) {
        if (now < hit.freshUntil) return hit.value;
        if (now < hit.staleUntil) {
          // 软过期：后台刷新，忽略错误
          if (!inflight.has(key)) {
            load(key, loader).catch(() => {
              /* swallow: 后台刷新失败保留旧值 */
            });
          }
          return hit.value;
        }
        // 硬过期
        store.delete(key);
      }
      return load(key, loader);
    },
    // 主动失效（管理端变更配置后调用）
    invalidate(key: string) {
      store.delete(key);
    },
    /**
     * 主动写入缓存（不经过 loader）。
     * 场景：调用方需要自己判断是否写入（例如 VOD 才缓存、live 不缓存）时使用。
     */
    set(key: string, value: T) {
      const now = Date.now();
      store.set(key, {
        value,
        freshUntil: now + freshMs,
        staleUntil: now + freshMs + staleMs,
      });
      evictIfNeeded();
    },
    /** 仅读取 fresh/stale 命中，命中返回 { value, fresh }；未命中/彻底过期返回 null。 */
    peek(key: string): { value: T; fresh: boolean } | null {
      const now = Date.now();
      const hit = store.get(key);
      if (!hit) return null;
      if (now < hit.freshUntil) return { value: hit.value, fresh: true };
      if (now < hit.staleUntil) return { value: hit.value, fresh: false };
      store.delete(key);
      return null;
    },
    clear() {
      store.clear();
      inflight.clear();
    },
    size() {
      return store.size;
    },
  };
}
