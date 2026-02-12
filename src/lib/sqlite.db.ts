/* eslint-disable no-console */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

const SEARCH_HISTORY_LIMIT = 20;

type LocalDbSchema = {
  users: Record<string, string>;
  playRecords: Record<string, Record<string, PlayRecord>>;
  favorites: Record<string, Record<string, Favorite>>;
  searchHistory: Record<string, string[]>;
  skipConfigs: Record<string, Record<string, SkipConfig>>;
  adminConfig: AdminConfig | null;
};

function ensureObject<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

function normalizeDbData(raw: unknown): LocalDbSchema {
  const db = ensureObject<Partial<LocalDbSchema>>(raw, {});
  return {
    users: ensureObject<Record<string, string>>(db.users, {}),
    playRecords: ensureObject<Record<string, Record<string, PlayRecord>>>(
      db.playRecords,
      {},
    ),
    favorites: ensureObject<Record<string, Record<string, Favorite>>>(
      db.favorites,
      {},
    ),
    searchHistory: ensureObject<Record<string, string[]>>(db.searchHistory, {}),
    skipConfigs: ensureObject<Record<string, Record<string, SkipConfig>>>(
      db.skipConfigs,
      {},
    ),
    adminConfig: db.adminConfig || null,
  };
}

function parseJsonValue<T>(raw: string | null | undefined): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class LocalSqliteStorage implements IStorage {
  private readonly dbPath: string;
  private readonly legacyJsonPaths: string[];
  private readonly db: Database.Database;

  constructor(dbPath?: string) {
    const defaultSqlitePath = process.env.DOCKER_ENV
      ? '/data/icetv-data.sqlite'
      : path.resolve(process.cwd(), 'data', 'icetv-data.sqlite');
    const defaultJsonPath = process.env.DOCKER_ENV
      ? '/data/icetv-data.json'
      : path.resolve(process.cwd(), 'data', 'icetv-data.json');
    const legacyJsonPath = process.env.DOCKER_ENV
      ? '/data/moontv-data.json'
      : path.resolve(process.cwd(), 'data', 'moontv-data.json');

    const configuredPath =
      dbPath ||
      process.env.LOCAL_SQLITE_PATH ||
      process.env.LOCAL_DB_PATH ||
      defaultSqlitePath;

    const isLegacyJsonPath = configuredPath.toLowerCase().endsWith('.json');
    this.dbPath = isLegacyJsonPath
      ? configuredPath.replace(/\.json$/i, '.sqlite')
      : configuredPath;

    const candidates = [defaultJsonPath, legacyJsonPath];
    if (isLegacyJsonPath) {
      candidates.unshift(configuredPath);
    }
    this.legacyJsonPaths = Array.from(new Set(candidates));

    mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initializeSchema();
    this.migrateFromLegacyJsonIfNeeded();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS play_records (
        username TEXT NOT NULL,
        record_key TEXT NOT NULL,
        record_json TEXT NOT NULL,
        PRIMARY KEY (username, record_key)
      );

      CREATE TABLE IF NOT EXISTS favorites (
        username TEXT NOT NULL,
        favorite_key TEXT NOT NULL,
        favorite_json TEXT NOT NULL,
        PRIMARY KEY (username, favorite_key)
      );

      CREATE TABLE IF NOT EXISTS search_history (
        username TEXT NOT NULL,
        keyword TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        PRIMARY KEY (username, keyword)
      );

      CREATE TABLE IF NOT EXISTS skip_configs (
        username TEXT NOT NULL,
        config_key TEXT NOT NULL,
        config_json TEXT NOT NULL,
        PRIMARY KEY (username, config_key)
      );

      CREATE TABLE IF NOT EXISTS admin_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        config_json TEXT NOT NULL
      );
    `);
  }

  private hasAnyData(): boolean {
    const checks = [
      'SELECT 1 AS v FROM users LIMIT 1',
      'SELECT 1 AS v FROM play_records LIMIT 1',
      'SELECT 1 AS v FROM favorites LIMIT 1',
      'SELECT 1 AS v FROM search_history LIMIT 1',
      'SELECT 1 AS v FROM skip_configs LIMIT 1',
      'SELECT 1 AS v FROM admin_config LIMIT 1',
    ];
    return checks.some((sql) => Boolean(this.db.prepare(sql).get()));
  }

  private readLegacyJsonData(): LocalDbSchema | null {
    for (const legacyPath of this.legacyJsonPaths) {
      if (!existsSync(legacyPath)) {
        continue;
      }
      try {
        const content = readFileSync(legacyPath, 'utf-8');
        const parsed = JSON.parse(content) as unknown;
        return normalizeDbData(parsed);
      } catch (error) {
        console.error(`读取旧 JSON 数据失败: ${legacyPath}`, error);
      }
    }
    return null;
  }

  private migrateFromLegacyJsonIfNeeded(): void {
    if (this.hasAnyData()) {
      return;
    }

    const legacyData = this.readLegacyJsonData();
    if (!legacyData) {
      return;
    }

    const migrate = this.db.transaction(() => {
      const insertUser = this.db.prepare(
        'INSERT OR REPLACE INTO users (username, password) VALUES (?, ?)',
      );
      const insertPlayRecord = this.db.prepare(
        'INSERT OR REPLACE INTO play_records (username, record_key, record_json) VALUES (?, ?, ?)',
      );
      const insertFavorite = this.db.prepare(
        'INSERT OR REPLACE INTO favorites (username, favorite_key, favorite_json) VALUES (?, ?, ?)',
      );
      const insertHistory = this.db.prepare(
        'INSERT OR REPLACE INTO search_history (username, keyword, sort_index) VALUES (?, ?, ?)',
      );
      const insertSkipConfig = this.db.prepare(
        'INSERT OR REPLACE INTO skip_configs (username, config_key, config_json) VALUES (?, ?, ?)',
      );
      const insertAdminConfig = this.db.prepare(
        'INSERT OR REPLACE INTO admin_config (id, config_json) VALUES (1, ?)',
      );

      for (const [userName, password] of Object.entries(legacyData.users)) {
        insertUser.run(userName, password);
      }

      for (const [userName, records] of Object.entries(
        legacyData.playRecords,
      )) {
        for (const [key, record] of Object.entries(records)) {
          insertPlayRecord.run(userName, key, JSON.stringify(record));
        }
      }

      for (const [userName, favorites] of Object.entries(
        legacyData.favorites,
      )) {
        for (const [key, favorite] of Object.entries(favorites)) {
          insertFavorite.run(userName, key, JSON.stringify(favorite));
        }
      }

      for (const [userName, keywords] of Object.entries(
        legacyData.searchHistory,
      )) {
        if (!Array.isArray(keywords)) {
          continue;
        }
        keywords.slice(0, SEARCH_HISTORY_LIMIT).forEach((keyword, index) => {
          insertHistory.run(userName, keyword, index);
        });
      }

      for (const [userName, configs] of Object.entries(
        legacyData.skipConfigs,
      )) {
        for (const [key, config] of Object.entries(configs)) {
          insertSkipConfig.run(userName, key, JSON.stringify(config));
        }
      }

      if (legacyData.adminConfig) {
        insertAdminConfig.run(JSON.stringify(legacyData.adminConfig));
      }
    });

    migrate();
    console.log(`检测到旧 JSON 数据，已迁移到 SQLite: ${this.dbPath}`);
  }

  async getPlayRecord(
    userName: string,
    key: string,
  ): Promise<PlayRecord | null> {
    const row = this.db
      .prepare(
        'SELECT record_json FROM play_records WHERE username = ? AND record_key = ?',
      )
      .get(userName, key) as { record_json: string } | undefined;
    return parseJsonValue<PlayRecord>(row?.record_json);
  }

  async setPlayRecord(
    userName: string,
    key: string,
    record: PlayRecord,
  ): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO play_records (username, record_key, record_json) VALUES (?, ?, ?)',
      )
      .run(userName, key, JSON.stringify(record));
  }

  async getAllPlayRecords(
    userName: string,
  ): Promise<{ [key: string]: PlayRecord }> {
    const rows = this.db
      .prepare(
        'SELECT record_key, record_json FROM play_records WHERE username = ?',
      )
      .all(userName) as { record_key: string; record_json: string }[];

    const result: Record<string, PlayRecord> = {};
    for (const row of rows) {
      const parsed = parseJsonValue<PlayRecord>(row.record_json);
      if (parsed) {
        result[row.record_key] = parsed;
      }
    }
    return result;
  }

  async deletePlayRecord(userName: string, key: string): Promise<void> {
    this.db
      .prepare('DELETE FROM play_records WHERE username = ? AND record_key = ?')
      .run(userName, key);
  }

  async getFavorite(userName: string, key: string): Promise<Favorite | null> {
    const row = this.db
      .prepare(
        'SELECT favorite_json FROM favorites WHERE username = ? AND favorite_key = ?',
      )
      .get(userName, key) as { favorite_json: string } | undefined;
    return parseJsonValue<Favorite>(row?.favorite_json);
  }

  async setFavorite(
    userName: string,
    key: string,
    favorite: Favorite,
  ): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO favorites (username, favorite_key, favorite_json) VALUES (?, ?, ?)',
      )
      .run(userName, key, JSON.stringify(favorite));
  }

  async getAllFavorites(
    userName: string,
  ): Promise<{ [key: string]: Favorite }> {
    const rows = this.db
      .prepare(
        'SELECT favorite_key, favorite_json FROM favorites WHERE username = ?',
      )
      .all(userName) as { favorite_key: string; favorite_json: string }[];

    const result: Record<string, Favorite> = {};
    for (const row of rows) {
      const parsed = parseJsonValue<Favorite>(row.favorite_json);
      if (parsed) {
        result[row.favorite_key] = parsed;
      }
    }
    return result;
  }

  async deleteFavorite(userName: string, key: string): Promise<void> {
    this.db
      .prepare('DELETE FROM favorites WHERE username = ? AND favorite_key = ?')
      .run(userName, key);
  }

  async registerUser(userName: string, password: string): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO users (username, password) VALUES (?, ?)',
      )
      .run(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT password FROM users WHERE username = ?')
      .get(userName) as { password: string } | undefined;
    return row?.password === password;
  }

  async checkUserExist(userName: string): Promise<boolean> {
    return Boolean(
      this.db
        .prepare('SELECT 1 AS v FROM users WHERE username = ? LIMIT 1')
        .get(userName),
    );
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    this.db
      .prepare('UPDATE users SET password = ? WHERE username = ?')
      .run(newPassword, userName);
  }

  async deleteUser(userName: string): Promise<void> {
    const remove = this.db.transaction((targetUser: string) => {
      this.db.prepare('DELETE FROM users WHERE username = ?').run(targetUser);
      this.db
        .prepare('DELETE FROM play_records WHERE username = ?')
        .run(targetUser);
      this.db
        .prepare('DELETE FROM favorites WHERE username = ?')
        .run(targetUser);
      this.db
        .prepare('DELETE FROM search_history WHERE username = ?')
        .run(targetUser);
      this.db
        .prepare('DELETE FROM skip_configs WHERE username = ?')
        .run(targetUser);
    });
    remove(userName);
  }

  async getSearchHistory(userName: string): Promise<string[]> {
    const rows = this.db
      .prepare(
        'SELECT keyword FROM search_history WHERE username = ? ORDER BY sort_index ASC',
      )
      .all(userName) as { keyword: string }[];
    return rows.map((row) => row.keyword);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const current = await this.getSearchHistory(userName);
    const next = [keyword, ...current.filter((item) => item !== keyword)].slice(
      0,
      SEARCH_HISTORY_LIMIT,
    );

    const save = this.db.transaction(
      (targetUser: string, keywords: string[]) => {
        this.db
          .prepare('DELETE FROM search_history WHERE username = ?')
          .run(targetUser);
        const insert = this.db.prepare(
          'INSERT INTO search_history (username, keyword, sort_index) VALUES (?, ?, ?)',
        );
        keywords.forEach((item, index) => {
          insert.run(targetUser, item, index);
        });
      },
    );

    save(userName, next);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    if (!keyword) {
      this.db
        .prepare('DELETE FROM search_history WHERE username = ?')
        .run(userName);
      return;
    }

    this.db
      .prepare('DELETE FROM search_history WHERE username = ? AND keyword = ?')
      .run(userName, keyword);
  }

  async getAllUsers(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT username FROM users ORDER BY username ASC')
      .all() as { username: string }[];
    return rows.map((row) => row.username);
  }

  async getAdminConfig(): Promise<AdminConfig | null> {
    const row = this.db
      .prepare('SELECT config_json FROM admin_config WHERE id = 1')
      .get() as { config_json: string } | undefined;
    return parseJsonValue<AdminConfig>(row?.config_json);
  }

  async setAdminConfig(config: AdminConfig): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO admin_config (id, config_json) VALUES (1, ?)',
      )
      .run(JSON.stringify(config));
  }

  async getSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<SkipConfig | null> {
    const key = `${source}+${id}`;
    const row = this.db
      .prepare(
        'SELECT config_json FROM skip_configs WHERE username = ? AND config_key = ?',
      )
      .get(userName, key) as { config_json: string } | undefined;
    return parseJsonValue<SkipConfig>(row?.config_json);
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig,
  ): Promise<void> {
    const key = `${source}+${id}`;
    this.db
      .prepare(
        'INSERT OR REPLACE INTO skip_configs (username, config_key, config_json) VALUES (?, ?, ?)',
      )
      .run(userName, key, JSON.stringify(config));
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string,
  ): Promise<void> {
    const key = `${source}+${id}`;
    this.db
      .prepare('DELETE FROM skip_configs WHERE username = ? AND config_key = ?')
      .run(userName, key);
  }

  async getAllSkipConfigs(
    userName: string,
  ): Promise<{ [key: string]: SkipConfig }> {
    const rows = this.db
      .prepare(
        'SELECT config_key, config_json FROM skip_configs WHERE username = ?',
      )
      .all(userName) as { config_key: string; config_json: string }[];

    const result: Record<string, SkipConfig> = {};
    for (const row of rows) {
      const parsed = parseJsonValue<SkipConfig>(row.config_json);
      if (parsed) {
        result[row.config_key] = parsed;
      }
    }
    return result;
  }

  async clearAllData(): Promise<void> {
    const clear = this.db.transaction(() => {
      this.db.exec(`
        DELETE FROM users;
        DELETE FROM play_records;
        DELETE FROM favorites;
        DELETE FROM search_history;
        DELETE FROM skip_configs;
        DELETE FROM admin_config;
      `);
    });

    clear();
    console.log(`SQLite 数据库已清空: ${this.dbPath}`);
  }
}
