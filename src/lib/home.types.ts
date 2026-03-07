import { BangumiCalendarData } from './bangumi';
import { DoubanItem } from './types';

export interface HomeInitialData {
  hotMovies: DoubanItem[];
  hotTvShows: DoubanItem[];
  hotVarietyShows: DoubanItem[];
  bangumiCalendarData: BangumiCalendarData[];
}
