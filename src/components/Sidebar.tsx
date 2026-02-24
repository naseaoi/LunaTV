'use client';

import {
  Cat,
  Clover,
  Film,
  Home,
  Menu,
  Radio,
  Search,
  Star,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { useSite } from './SiteProvider';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

// 站点图标：有自定义则用自定义，否则用默认 favicon
const SiteIcon = () => {
  const { siteIcon, siteName } = useSite();
  const iconSrc = siteIcon || '/favicon.ico';

  return (
    <img
      src={iconSrc}
      alt={siteName}
      className='w-full h-full object-contain'
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        // 自定义图标加载失败时回退到默认 favicon
        if (img.src !== window.location.origin + '/favicon.ico') {
          img.src = '/favicon.ico';
        }
      }}
    />
  );
};

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

// 在浏览器环境下通过全局变量缓存折叠状态，避免组件重新挂载时出现初始值闪烁
declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const getInitialSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.__sidebarCollapsed === 'boolean') {
    return window.__sidebarCollapsed;
  }

  const saved = localStorage.getItem('sidebarCollapsed');
  if (saved === null) {
    return false;
  }

  try {
    const parsed = JSON.parse(saved);
    return parsed === true;
  } catch {
    return false;
  }
};

const Sidebar = ({ onToggle, activePath = '/' }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { siteName } = useSite();
  // 若同一次 SPA 会话中已经读取过折叠状态，则直接复用，避免闪烁
  const [isCollapsed, setIsCollapsed] = useState<boolean>(
    getInitialSidebarCollapsed,
  );

  // 当折叠状态变化时，同步到 <html> data 属性，供首屏 CSS 使用
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.documentElement.dataset.sidebarCollapsed = 'true';
      } else {
        delete document.documentElement.dataset.sidebarCollapsed;
      }
    }
  }, [isCollapsed]);

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    // 优先使用传入的 activePath
    if (activePath) {
      setActive(activePath);
    } else {
      // 否则使用当前路径
      const getCurrentFullPath = () => {
        const queryString = searchParams.toString();
        return queryString ? `${pathname}?${queryString}` : pathname;
      };
      const fullPath = getCurrentFullPath();
      setActive(fullPath);
    }
  }, [activePath, pathname, searchParams]);

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    if (typeof window !== 'undefined') {
      window.__sidebarCollapsed = newState;
    }
    onToggle?.(newState);
  }, [isCollapsed, onToggle]);

  useEffect(() => {
    router.prefetch('/');
    router.prefetch('/search');
    router.prefetch('/douban?type=movie');
    router.prefetch('/douban?type=tv');
    router.prefetch('/douban?type=anime');
    router.prefetch('/douban?type=show');
    router.prefetch('/douban?type=custom');
    router.prefetch('/live');
  }, [router]);

  const contextValue = {
    isCollapsed,
  };

  const [menuItems, setMenuItems] = useState([
    {
      icon: Film,
      label: '电影',
      href: '/douban?type=movie',
    },
    {
      icon: Tv,
      label: '剧集',
      href: '/douban?type=tv',
    },
    {
      icon: Cat,
      label: '动漫',
      href: '/douban?type=anime',
    },
    {
      icon: Clover,
      label: '综艺',
      href: '/douban?type=show',
    },
    {
      icon: Radio,
      label: '直播',
      href: '/live',
    },
  ]);

  useEffect(() => {
    const runtimeConfig = window.RUNTIME_CONFIG;
    if ((runtimeConfig?.CUSTOM_CATEGORIES?.length ?? 0) > 0) {
      setMenuItems((prevItems) => [
        ...prevItems,
        {
          icon: Star,
          label: '自定义',
          href: '/douban?type=custom',
        },
      ]);
    }
  }, []);

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 在移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          className={`fixed top-0 left-0 h-screen bg-white/40 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] border-r border-gray-200/50 z-10 shadow-lg dark:bg-gray-900/70 dark:border-gray-700/50 ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <div className='flex h-full flex-col'>
            {/* 顶部品牌区域 - 完全复制菜单项布局结构以保证对齐 */}
            <div className='px-2 flex items-center h-16'>
              <Link
                href='/'
                className={`flex items-center rounded-lg px-2 py-2 pl-2 w-full select-none hover:opacity-90 transition-opacity duration-200 min-h-[40px] gap-2.5 justify-start overflow-hidden`}
              >
                <div className='w-8 h-8 flex-shrink-0'>
                  <SiteIcon />
                </div>
                <span
                  className={`text-base font-bold text-gray-800 dark:text-gray-100 tracking-tight whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    isCollapsed
                      ? 'max-w-0 opacity-0'
                      : 'max-w-[140px] opacity-100'
                  }`}
                >
                  {siteName}
                </span>
              </Link>
            </div>
            {/* 分割线 */}
            <div className='mx-3 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent' />

            {/* 首页和搜索导航 */}
            <nav className='px-2 mt-4 space-y-1'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                data-active={active === '/'}
                className={`group flex items-center rounded-lg px-2 py-2 pl-4 text-gray-700 hover:bg-gray-100/30 hover:text-green-600 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/10 dark:data-[active=true]:text-green-400 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex-shrink-0 flex items-center justify-center'>
                  <Home className='h-4 w-4 text-gray-500 group-hover:text-green-600 data-[active=true]:text-green-700 dark:text-gray-400 dark:group-hover:text-green-400 dark:data-[active=true]:text-green-400' />
                </div>
                <span
                  className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    isCollapsed
                      ? 'max-w-0 opacity-0'
                      : 'max-w-[120px] opacity-100'
                  }`}
                >
                  首页
                </span>
              </Link>
              <Link
                href='/search'
                onClick={() => setActive('/search')}
                onMouseEnter={() => router.prefetch('/search')}
                data-active={active === '/search'}
                className={`group flex items-center rounded-lg px-2 py-2 pl-4 text-gray-700 hover:bg-gray-100/30 hover:text-green-600 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/10 dark:data-[active=true]:text-green-400 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex-shrink-0 flex items-center justify-center'>
                  <Search className='h-4 w-4 text-gray-500 group-hover:text-green-600 data-[active=true]:text-green-700 dark:text-gray-400 dark:group-hover:text-green-400 dark:data-[active=true]:text-green-400' />
                </div>
                <span
                  className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    isCollapsed
                      ? 'max-w-0 opacity-0'
                      : 'max-w-[120px] opacity-100'
                  }`}
                >
                  搜索
                </span>
              </Link>
            </nav>

            {/* 菜单项 */}
            <div className='flex-1 overflow-y-auto px-2 pt-4'>
              <div className='space-y-1'>
                {menuItems.map((item) => {
                  // 检查当前路径是否匹配这个菜单项
                  const typeMatch = item.href.match(/type=([^&]+)/)?.[1];

                  // 解码URL以进行正确的比较
                  const decodedActive = decodeURIComponent(active);
                  const decodedItemHref = decodeURIComponent(item.href);

                  const isActive =
                    decodedActive === decodedItemHref ||
                    (decodedActive.startsWith('/douban') &&
                      decodedActive.includes(`type=${typeMatch}`));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setActive(item.href)}
                      onMouseEnter={() => router.prefetch(item.href)}
                      data-active={isActive}
                      className={`group flex items-center rounded-lg px-2 py-2 pl-4 text-sm text-gray-700 hover:bg-gray-100/30 hover:text-green-600 data-[active=true]:bg-green-500/20 data-[active=true]:text-green-700 transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/10 dark:data-[active=true]:text-green-400 ${
                        isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                      } gap-3 justify-start`}
                    >
                      <div className='w-4 h-4 flex-shrink-0 flex items-center justify-center'>
                        <Icon className='h-4 w-4 text-gray-500 group-hover:text-green-600 data-[active=true]:text-green-700 dark:text-gray-400 dark:group-hover:text-green-400 dark:data-[active=true]:text-green-400' />
                      </div>
                      <span
                        className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                          isCollapsed
                            ? 'max-w-0 opacity-0'
                            : 'max-w-[120px] opacity-100'
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 底部折叠/展开按钮 */}
            <div className='px-2 pb-4 pt-2'>
              <div className='mx-1 mb-2 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent' />
              <button
                onClick={handleToggle}
                className={`group flex items-center rounded-lg px-2 py-2 pl-4 w-full text-sm text-gray-500 hover:bg-gray-100/30 hover:text-green-600 transition-colors duration-200 min-h-[40px] dark:text-gray-400 dark:hover:text-green-400 gap-3 justify-start`}
                title={isCollapsed ? '展开侧栏' : '折叠侧栏'}
              >
                <div className='w-4 h-4 flex-shrink-0 flex items-center justify-center'>
                  <Menu className='h-4 w-4' />
                </div>
                <span
                  className={`whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
                    isCollapsed
                      ? 'max-w-0 opacity-0'
                      : 'max-w-[120px] opacity-100'
                  }`}
                >
                  折叠
                </span>
              </button>
            </div>
          </div>
        </aside>
        <div
          className={`transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] sidebar-offset ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
