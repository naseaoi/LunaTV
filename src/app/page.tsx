import HomeClient from '@/components/home/HomeClient';
import { getHomeInitialData } from '@/lib/home.server';

export default async function Home() {
  const initialData = await getHomeInitialData();

  return <HomeClient initialData={initialData} />;
}
