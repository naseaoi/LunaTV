import { AdminConfig } from './admin.types';
import { LocalSqliteStorage } from './sqlite.db';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// storage type 常量: 'localstorage' | 'localdb'，默认 'localdb'
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'localdb'
    | undefined) || 'localdb';

// 创建存储实例
function createStorage(): IStorage {
  switch (STORAGE_TYPE) {
    case 'localdb':
      return new LocalSqliteStorage();
    case 'localstorage':
      // localstorage 仅用于前端缓存策略，服务端仍需可用存储承载用户/配置数据
      return new LocalSqliteStorage();
    default:
      return new LocalSqliteStorage();
  }
}

// 单例存储实例
let storageInstance: IStorage | null = null;

function getStorage(): IStorage {
  if (!storageInstance) {
    storageInstance = createStorage();
  }
  return storageInstance;
}

// 工具函数：生成存储key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// 导出便捷方法
export class DbManager {
  private storage: IStorage;

  constructor() {
    this.storage = getStorage();
  }

  // 播放记录相关方法
  async getPlayRecord(
    userName: string,
    source: string,
    id: string,
  ): Promise<PlayRecord | null> {
    const key = generateStorageKey(source, id);
    return this.storage.getPlayRecord(userName, key);
  }

  async savePlayRecord(
    userName: string,
    source: string,
    id: string,
    record: PlayRecord,
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.setPlayRecord(userName, key, record);
  }

  async getAllPlayRecords(userName: string): Promise<{
    [key: string]: PlayRecord;
  }> {
    return this.storage.getAllPlayRecords(userName);
  }

  async deletePlayRecord(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.deletePlayRecord(userName, key);
  }

  /** 按原始 key 写入播放记录（用于数据导入等场景） */
  async setPlayRecordByKey(
    userName: string,
    key: string,
    record: PlayRecord,
  ): Promise<void> {
    await this.storage.setPlayRecord(userName, key, record);
  }

  // 收藏相关方法
  async getFavorite(
    userName: string,
    source: string,
    id: string,
  ): Promise<Favorite | null> {
    const key = generateStorageKey(source, id);
    return this.storage.getFavorite(userName, key);
  }

  async saveFavorite(
    userName: string,
    source: string,
    id: string,
    favorite: Favorite,
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.setFavorite(userName, key, favorite);
  }

  async getAllFavorites(
    userName: string,
  ): Promise<{ [key: string]: Favorite }> {
    return this.storage.getAllFavorites(userName);
  }

  async deleteFavorite(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    const key = generateStorageKey(source, id);
    await this.storage.deleteFavorite(userName, key);
  }

  /** 按原始 key 写入收藏（用于数据导入等场景） */
  async setFavoriteByKey(
    userName: string,
    key: string,
    favorite: Favorite,
  ): Promise<void> {
    await this.storage.setFavorite(userName, key, favorite);
  }

  async isFavorited(
    userName: string,
    source: string,
    id: string,
  ): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  // ---------- 用户相关 ----------
  async registerUser(userName: string, password: string): Promise<void> {
    await this.storage.registerUser(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    return this.storage.verifyUser(userName, password);
  }

  // 检查用户是否已存在
  async checkUserExist(userName: string): Promise<boolean> {
    return this.storage.checkUserExist(userName);
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    await this.storage.changePassword(userName, newPassword);
  }

  async deleteUser(userName: string): Promise<void> {
    await this.storage.deleteUser(userName);
  }

  // ---------- 搜索历史 ----------
  async getSearchHistory(userName: string): Promise<string[]> {
    return this.storage.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    await this.storage.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    await this.storage.deleteSearchHistory(userName, keyword);
  }

  // 获取全部用户名
  async getAllUsers(): Promise<string[]> {
    return this.storage.getAllUsers();
  }

  // ---------- 管理员配置 ----------
  async getAdminConfig(): Promise<AdminConfig | null> {
    return this.storage.getAdminConfig();
  }

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    await this.storage.setAdminConfig(config);
  }

  // ---------- 跳过片头片尾配置 ----------
  async getSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<SkipConfig | null> {
    return this.storage.getSkipConfig(userName, source, id);
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig,
  ): Promise<void> {
    await this.storage.setSkipConfig(userName, source, id, config);
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    await this.storage.deleteSkipConfig(userName, source, id);
  }

  async getAllSkipConfigs(
    userName: string,
  ): Promise<{ [key: string]: SkipConfig }> {
    return this.storage.getAllSkipConfigs(userName);
  }

  // ---------- 数据清理 ----------
  async clearAllData(): Promise<void> {
    await this.storage.clearAllData();
  }
}

// 导出默认实例
export const db = new DbManager();
