import HomeClient from '@/components/home/HomeClient';
import { getHomeInitialData } from '@/lib/home.server';

/** 首页推荐数据 5 分钟 ISR 缓存，避免每次导航都阻塞等待外部 API */
export const revalidate = 300;

export default async function Home() {
  const initialData = await getHomeInitialData();

  return <HomeClient initialData={initialData} />;
}
