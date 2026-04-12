import type HlsType from 'hls.js';

type PlayerModules = {
  Artplayer: any;
  Hls: any;
};

type HlsLoaderInstance = {
  load: (...args: unknown[]) => void;
};

type HlsLoaderConstructor = new (config: unknown) => HlsLoaderInstance;

type LoaderContext = {
  type?: string;
  url?: string;
};

type LoaderCallbacks = {
  onSuccess?: (...args: unknown[]) => unknown;
};

export type ManagedVideoElement = HTMLVideoElement & {
  hls?: HlsType | null;
  __icetvHlsCleanup?: (() => void) | null;
};

let playerModulesPromise: Promise<PlayerModules> | null = null;

/** 缓存播放器模块，避免切集/切台时重复触发动态导入链路。 */
export async function getPlayerModules(): Promise<PlayerModules> {
  if (playerModulesPromise) {
    return playerModulesPromise;
  }

  playerModulesPromise = Promise.all([
    import('artplayer'),
    import('hls.js'),
  ]).then(([{ default: Artplayer }, { default: Hls }]) => ({
    Artplayer,
    Hls,
  }));

  return playerModulesPromise;
}

export function getManagedVideo(video: HTMLVideoElement): ManagedVideoElement {
  return video as ManagedVideoElement;
}

/** 运行并移除挂在 video 上的清理逻辑，避免监听器和旧实例残留。 */
export function runManagedVideoCleanup(video?: HTMLVideoElement | null): void {
  const managedVideo = video as ManagedVideoElement | null | undefined;
  if (!managedVideo) return;

  const cleanup = managedVideo.__icetvHlsCleanup;
  managedVideo.__icetvHlsCleanup = null;
  cleanup?.();
}

export function assignManagedVideoCleanup(
  video: HTMLVideoElement,
  cleanup: () => void,
): ManagedVideoElement {
  const managedVideo = getManagedVideo(video);
  managedVideo.__icetvHlsCleanup = cleanup;
  return managedVideo;
}

export function destroyManagedHls(video?: HTMLVideoElement | null): void {
  const managedVideo = video as ManagedVideoElement | null | undefined;
  if (!managedVideo?.hls) return;

  managedVideo.hls.destroy();
  managedVideo.hls = null;
}

type HlsLoaderFactoryOptions = {
  rewriteContext?: (context: LoaderContext) => void;
  transformManifestText?: (content: string, context: LoaderContext) => string;
};

/**
 * 构造可复用的 HLS Loader：支持请求上下文改写，以及对 manifest/level 文本做二次处理。
 */
export function createHlsLoaderClass(
  BaseLoader: HlsLoaderConstructor,
  options: HlsLoaderFactoryOptions,
): HlsLoaderConstructor {
  return class extends BaseLoader {
    constructor(config: unknown) {
      super(config);

      const load = this.load.bind(this);
      this.load = function (
        context: unknown,
        loadConfig: unknown,
        callbacks: unknown,
      ) {
        const loaderContext = context as LoaderContext;
        const loaderCallbacks = callbacks as LoaderCallbacks;

        options.rewriteContext?.(loaderContext);

        if (
          options.transformManifestText &&
          (loaderContext.type === 'manifest' ||
            loaderContext.type === 'level') &&
          loaderCallbacks.onSuccess
        ) {
          const onSuccess = loaderCallbacks.onSuccess;
          loaderCallbacks.onSuccess = function (
            response: unknown,
            stats: unknown,
            callbackContext: unknown,
            networkDetails?: unknown,
          ) {
            const nextResponse = response as { data?: unknown };
            if (typeof nextResponse.data === 'string') {
              nextResponse.data = options.transformManifestText!(
                nextResponse.data,
                loaderContext,
              );
            }
            return onSuccess(response, stats, callbackContext, networkDetails);
          };
        }

        load(context, loadConfig, callbacks);
      };
    }
  };
}
