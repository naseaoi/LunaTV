# API 鉴权维护指南

API 路由的权限校验模块总览、使用约定和路由清单。

## 核心模块

| 模块                    | 职责                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/api-auth.ts`   | `requireActiveUser` / `requireAdmin` / `requireOwner` / `isGuardFailure`           |
| `src/lib/env.server.ts` | `getOwnerUsername()` / `getOwnerPassword()`，优先级：`ICETV_*` > `MOONTV_*` > 裸名 |
| `src/lib/config.ts`     | `getConfig` / `resetConfig` 等配置读写                                             |
| `src/lib/db.ts`         | 服务端统一数据访问入口                                                             |

## HTTP 状态码约定

| 状态码 | 语义             |
| ------ | ---------------- |
| 401    | 未登录           |
| 403    | 已登录但权限不足 |
| 400    | 参数错误         |
| 404    | 资源不存在       |
| 500    | 服务异常         |

## 权限层级

- 普通登录用户接口 → `requireActiveUser`
- admin + owner 都可访问 → `requireAdmin`
- 仅 owner 可访问 → `requireOwner`

## 新增 API 模板

普通用户接口：

```ts
const guardResult = await requireActiveUser(request);
if (isGuardFailure(guardResult)) return guardResult.response;
const username = guardResult.username;
```

管理员接口：

```ts
const guardResult = await requireAdmin(request);
if (isGuardFailure(guardResult)) return guardResult.response;
```

站长接口：

```ts
const guardResult = await requireOwner(request);
if (isGuardFailure(guardResult)) return guardResult.response;
```

## 已接入 Guard 的路由清单

### 用户能力 API

- `src/app/api/favorites/route.ts`
- `src/app/api/playrecords/route.ts`
- `src/app/api/searchhistory/route.ts`
- `src/app/api/skipconfigs/route.ts`
- `src/app/api/search/route.ts`
- `src/app/api/search/resources/route.ts`
- `src/app/api/search/one/route.ts`
- `src/app/api/search/suggestions/route.ts`
- `src/app/api/search/ws/route.ts`
- `src/app/api/detail/route.ts`
- `src/app/api/change-password/route.ts`

### 管理 API

- `src/app/api/admin/config/route.ts`
- `src/app/api/admin/site/route.ts`
- `src/app/api/admin/source/route.ts`
- `src/app/api/admin/category/route.ts`
- `src/app/api/admin/live/route.ts`
- `src/app/api/admin/live/refresh/route.ts`
- `src/app/api/admin/user/route.ts`
- `src/app/api/admin/source/validate/route.ts`
- `src/app/api/admin/config_file/route.ts`（owner）
- `src/app/api/admin/config_subscription/fetch/route.ts`（owner）
- `src/app/api/admin/reset/route.ts`（owner）
- `src/app/api/admin/data_migration/export/route.ts`（owner）
- `src/app/api/admin/data_migration/import/route.ts`（owner）

## 测试

每个权限接口至少覆盖三种场景：

1. 未登录 → 401
2. 已登录但权限不足 → 403
3. 具备权限 → 200

测试位置：`src/app/api/admin/__tests__/auth-guard.test.ts`

## 环境变量注意事项

- 推荐使用 `ICETV_USERNAME` / `ICETV_PASSWORD`
- 兼容 `MOONTV_USERNAME` / `MOONTV_PASSWORD` / `USERNAME` / `PASSWORD`
- Windows 本地开发时系统级 `USERNAME` 可能覆盖业务值，导致站长识别异常，务必显式设置 `ICETV_USERNAME`。
