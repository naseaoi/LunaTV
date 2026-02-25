'use client';

import { ExternalLink, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import AdminSelect from '@/features/admin/components/AdminSelect';
import AlertModal from '@/features/admin/components/AlertModal';
import { useAlertModal } from '@/features/admin/hooks/useAlertModal';
import { useLoadingState } from '@/features/admin/hooks/useLoadingState';
import { adminPost } from '@/features/admin/lib/api';
import { buttonStyles } from '@/features/admin/lib/buttonStyles';
import { showError, showSuccess } from '@/features/admin/lib/notifications';
import { AdminConfig } from '@/features/admin/types/api';
import { SiteConfig } from '@/features/admin/types';

const SiteConfigComponent = ({
  config,
  refreshConfig,
}: {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}) => {
  const { alertModal, showAlert, hideAlert } = useAlertModal();
  const { isLoading, withLoading } = useLoadingState();
  const [siteSettings, setSiteSettings] = useState<SiteConfig>({
    SiteName: '',
    SiteIcon: '',
    Announcement: '',
    SearchDownstreamMaxPage: 1,
    SiteInterfaceCacheTime: 7200,
    DoubanProxyType: 'direct',
    DoubanProxy: '',
    DoubanImageProxyType: 'cmliussss-cdn-tencent',
    DoubanImageProxy: '',
    DisableYellowFilter: false,
    FluidSearch: true,
    AdBlockMode: 'player',
  });

  // 站点图标相关状态
  const [iconPreview, setIconPreview] = useState<string>('');
  const [iconUploading, setIconUploading] = useState(false);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // 豆瓣数据源选项
  const doubanDataSourceOptions = [
    { value: 'direct', label: '直连（服务器直接请求豆瓣）' },
    { value: 'cors-proxy-zwei', label: 'Cors Proxy By Zwei' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  // 豆瓣图片代理选项
  const doubanImageProxyTypeOptions = [
    { value: 'direct', label: '直连（浏览器直接请求豆瓣）' },
    { value: 'server', label: '服务器代理（由服务器代理请求豆瓣）' },
    { value: 'img3', label: '豆瓣官方精品 CDN（阿里云）' },
    {
      value: 'cmliussss-cdn-tencent',
      label: '豆瓣 CDN By CMLiussss（腾讯云）',
    },
    { value: 'cmliussss-cdn-ali', label: '豆瓣 CDN By CMLiussss（阿里云）' },
    { value: 'custom', label: '自定义代理' },
  ];

  const adBlockModeOptions = [
    { value: 'player', label: '播放器侧处理（省服务器流量，可能闪帧）' },
    { value: 'server', label: '服务器预处理（更无感，消耗服务器流量）' },
  ];

  // 获取感谢信息
  const getThanksInfo = (dataSource: string) => {
    switch (dataSource) {
      case 'cors-proxy-zwei':
        return {
          text: 'Thanks to @Zwei',
          url: 'https://github.com/bestzwei',
        };
      case 'cmliussss-cdn-tencent':
      case 'cmliussss-cdn-ali':
        return {
          text: 'Thanks to @CMLiussss',
          url: 'https://github.com/cmliu',
        };
      default:
        return null;
    }
  };

  useEffect(() => {
    if (config?.SiteConfig) {
      setSiteSettings({
        ...config.SiteConfig,
        DoubanProxyType: config.SiteConfig.DoubanProxyType || 'direct',
        DoubanProxy: config.SiteConfig.DoubanProxy || '',
        DoubanImageProxyType:
          config.SiteConfig.DoubanImageProxyType || 'cmliussss-cdn-tencent',
        DoubanImageProxy: config.SiteConfig.DoubanImageProxy || '',
        DisableYellowFilter: config.SiteConfig.DisableYellowFilter || false,
        FluidSearch: config.SiteConfig.FluidSearch || true,
        AdBlockMode: config.SiteConfig.AdBlockMode || 'player',
      });
      // 初始化图标预览
      const icon = config.SiteConfig.SiteIcon;
      if (icon) {
        setIconPreview(icon.startsWith('/') ? `${icon}?t=${Date.now()}` : icon);
      }
    }
  }, [config]);

  // 处理豆瓣数据源变化
  const handleDoubanDataSourceChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanProxyType: value,
    }));
  };

  // 处理豆瓣图片代理变化
  const handleDoubanImageProxyChange = (value: string) => {
    setSiteSettings((prev) => ({
      ...prev,
      DoubanImageProxyType: value,
    }));
  };

  // 保存站点配置
  const handleSave = async () => {
    await withLoading('saveSiteConfig', async () => {
      try {
        await adminPost('/api/admin/site', { ...siteSettings }, '保存失败');

        showSuccess('保存成功, 请刷新页面', showAlert);
        await refreshConfig();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败', showAlert);
        throw err;
      }
    });
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* 站点名称 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            站点名称
          </label>
          <input
            type='text'
            value={siteSettings.SiteName}
            onChange={(e) =>
              setSiteSettings((prev) => ({ ...prev, SiteName: e.target.value }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        {/* 站点图标 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            站点图标
          </label>
          <div className='flex items-start gap-3'>
            {/* 预览 */}
            <div className='flex-shrink-0 w-10 h-10 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 flex items-center justify-center'>
              {iconPreview ? (
                <img
                  src={iconPreview}
                  alt='站点图标'
                  className='w-full h-full object-contain'
                  onError={() => setIconPreview('')}
                />
              ) : (
                <ImagePlus className='w-5 h-5 text-gray-400' />
              )}
            </div>
            <div className='flex-1 space-y-2'>
              {/* URL 输入 + 操作按钮同行 */}
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={siteSettings.SiteIcon}
                  onChange={(e) => {
                    const url = e.target.value;
                    setSiteSettings((prev) => ({ ...prev, SiteIcon: url }));
                    setIconPreview(url);
                  }}
                  placeholder='输入图标 URL 或上传文件'
                  className='flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm'
                />
                <button
                  type='button'
                  disabled={iconUploading}
                  onClick={() => iconFileRef.current?.click()}
                  className='flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
                >
                  <Upload className='w-3.5 h-3.5' />
                  {iconUploading ? '上传中...' : '上传'}
                </button>
                {siteSettings.SiteIcon && (
                  <button
                    type='button'
                    onClick={async () => {
                      if (
                        siteSettings.SiteIcon.startsWith('/api/admin/site-icon')
                      ) {
                        try {
                          await fetch('/api/admin/site-icon', {
                            method: 'DELETE',
                          });
                        } catch {
                          /* ignore */
                        }
                      }
                      setSiteSettings((prev) => ({ ...prev, SiteIcon: '' }));
                      setIconPreview('');
                    }}
                    className='flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-300 dark:border-red-600/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                    清除
                  </button>
                )}
              </div>
              <input
                ref={iconFileRef}
                type='file'
                accept='image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/x-icon'
                className='hidden'
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 512 * 1024) {
                    showError('图标文件不能超过 512KB', showAlert);
                    return;
                  }
                  setIconUploading(true);
                  try {
                    const formData = new FormData();
                    formData.append('icon', file);
                    const res = await fetch('/api/admin/site-icon', {
                      method: 'POST',
                      body: formData,
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      showError(data.error || '上传失败', showAlert);
                      return;
                    }
                    setSiteSettings((prev) => ({
                      ...prev,
                      SiteIcon: '/api/admin/site-icon',
                    }));
                    setIconPreview(
                      data.url || `/api/admin/site-icon?t=${Date.now()}`,
                    );
                    showSuccess('图标上传成功', showAlert);
                  } catch (err) {
                    showError('上传失败', showAlert);
                  } finally {
                    setIconUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
          <p className='mt-1.5 text-xs text-gray-400 dark:text-gray-500'>
            支持 URL 链接或本地上传（PNG/JPEG/WebP/SVG/ICO，≤512KB）
          </p>
        </div>

        {/* 站点公告 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            站点公告
          </label>
          <textarea
            value={siteSettings.Announcement}
            onChange={(e) =>
              setSiteSettings((prev) => ({
                ...prev,
                Announcement: e.target.value,
              }))
            }
            rows={1}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        {/* 去广告处理模式 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            去广告处理模式
          </label>
          <AdminSelect
            value={siteSettings.AdBlockMode || 'player'}
            onChange={(value) =>
              setSiteSettings((prev) => ({
                ...prev,
                AdBlockMode: value as 'player' | 'server',
              }))
            }
            options={adBlockModeOptions}
          />
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            仅影响播放页"去广告"开启时的处理方式。
          </p>
        </div>

        {/* 豆瓣数据源设置 */}
        <div className='space-y-3'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣数据代理
            </label>
            <AdminSelect
              value={siteSettings.DoubanProxyType}
              onChange={(value) => handleDoubanDataSourceChange(value)}
              options={doubanDataSourceOptions}
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择获取豆瓣数据的方式
            </p>

            {getThanksInfo(siteSettings.DoubanProxyType) && (
              <div className='mt-3'>
                <button
                  type='button'
                  onClick={() =>
                    window.open(
                      getThanksInfo(siteSettings.DoubanProxyType)!.url,
                      '_blank',
                    )
                  }
                  className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
                >
                  <span className='font-medium'>
                    {getThanksInfo(siteSettings.DoubanProxyType)!.text}
                  </span>
                  <ExternalLink className='w-3.5 opacity-70' />
                </button>
              </div>
            )}
          </div>

          {siteSettings.DoubanProxyType === 'custom' && (
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣代理地址
              </label>
              <input
                type='text'
                placeholder='例如: https://proxy.example.com/fetch?url='
                value={siteSettings.DoubanProxy}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    DoubanProxy: e.target.value,
                  }))
                }
                className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                自定义代理服务器地址
              </p>
            </div>
          )}
        </div>

        {/* 豆瓣图片代理设置 */}
        <div className='space-y-3'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣图片代理
            </label>
            <AdminSelect
              value={siteSettings.DoubanImageProxyType}
              onChange={(value) => handleDoubanImageProxyChange(value)}
              options={doubanImageProxyTypeOptions}
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择获取豆瓣图片的方式
            </p>

            {getThanksInfo(siteSettings.DoubanImageProxyType) && (
              <div className='mt-3'>
                <button
                  type='button'
                  onClick={() =>
                    window.open(
                      getThanksInfo(siteSettings.DoubanImageProxyType)!.url,
                      '_blank',
                    )
                  }
                  className='flex items-center justify-center gap-1.5 w-full px-3 text-xs text-gray-500 dark:text-gray-400 cursor-pointer'
                >
                  <span className='font-medium'>
                    {getThanksInfo(siteSettings.DoubanImageProxyType)!.text}
                  </span>
                  <ExternalLink className='w-3.5 opacity-70' />
                </button>
              </div>
            )}
          </div>

          {siteSettings.DoubanImageProxyType === 'custom' && (
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                豆瓣图片代理地址
              </label>
              <input
                type='text'
                placeholder='例如: https://proxy.example.com/fetch?url='
                value={siteSettings.DoubanImageProxy}
                onChange={(e) =>
                  setSiteSettings((prev) => ({
                    ...prev,
                    DoubanImageProxy: e.target.value,
                  }))
                }
                className='w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 shadow-sm hover:border-gray-400 dark:hover:border-gray-500'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                自定义图片代理服务器地址
              </p>
            </div>
          )}
        </div>

        {/* 搜索接口可拉取最大页数 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            搜索接口可拉取最大页数
          </label>
          <input
            type='number'
            min={1}
            value={siteSettings.SearchDownstreamMaxPage}
            onChange={(e) =>
              setSiteSettings((prev) => ({
                ...prev,
                SearchDownstreamMaxPage: Number(e.target.value),
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>

        {/* 站点接口缓存时间 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
            站点接口缓存时间（秒）
          </label>
          <input
            type='number'
            min={1}
            value={siteSettings.SiteInterfaceCacheTime}
            onChange={(e) =>
              setSiteSettings((prev) => ({
                ...prev,
                SiteInterfaceCacheTime: Number(e.target.value),
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div>
          <div className='flex items-center justify-between'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              NSFW模式
            </label>
            <button
              type='button'
              onClick={() =>
                setSiteSettings((prev) => ({
                  ...prev,
                  DisableYellowFilter: !prev.DisableYellowFilter,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                siteSettings.DisableYellowFilter
                  ? buttonStyles.toggleOn
                  : buttonStyles.toggleOff
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full ${
                  buttonStyles.toggleThumb
                } transition-transform ${
                  siteSettings.DisableYellowFilter
                    ? buttonStyles.toggleThumbOn
                    : buttonStyles.toggleThumbOff
                }`}
              />
            </button>
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            开启后，允许NSFW内容。
          </p>
        </div>

        <div>
          <div className='flex items-center justify-between'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              启用流式搜索
            </label>
            <button
              type='button'
              onClick={() =>
                setSiteSettings((prev) => ({
                  ...prev,
                  FluidSearch: !prev.FluidSearch,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                siteSettings.FluidSearch
                  ? buttonStyles.toggleOn
                  : buttonStyles.toggleOff
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full ${
                  buttonStyles.toggleThumb
                } transition-transform ${
                  siteSettings.FluidSearch
                    ? buttonStyles.toggleThumbOn
                    : buttonStyles.toggleThumbOff
                }`}
              />
            </button>
          </div>
          <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
            启用后搜索结果将实时流式返回，提升用户体验。
          </p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading('saveSiteConfig')}
          className={`px-4 py-2 ${
            isLoading('saveSiteConfig')
              ? buttonStyles.disabled
              : buttonStyles.success
          } rounded-lg transition-colors`}
        >
          {isLoading('saveSiteConfig') ? '保存中…' : '保存'}
        </button>
      </div>

      {/* 通用弹窗组件 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={hideAlert}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        timer={alertModal.timer}
        showConfirm={alertModal.showConfirm}
      />
    </div>
  );
};

export default SiteConfigComponent;
