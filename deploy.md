# CI 部署说明

> 本文是「弦间」的持续集成 / 自动部署说明。日常开发只需要 `git push`，服务器会自动构建并发布到 <http://music.kqhsxt.cn/>。

## 1. 一句话流程

```text
本地 commit / push
   │
   ▼
Gitee WebHook（仓库 → 管理 → WebHooks，Push 事件）
   │
   ▼
宝塔 WebHook 插件（面板端口 + access_key）
   │
   ▼
deploy/server-hook.sh
   ├─ git fetch + git reset --hard origin/master
   ├─ npm ci --include=dev
   ├─ 清理旧 dist → npm run build
   └─ deploy/deploy.sh：备份上一版 → 同步到发布目录
   │
   ▼
/www/wwwroot/music-score/dist  →  nginx  →  http://music.kqhsxt.cn/
```

## 2. 线上目录结构

```text
/www/wwwroot/music-score/
├── src/          代码仓库（Git 仓库，含 node_modules、构建产物 src/dist）
├── dist/         发布目录，nginx 的 root 指向这里
├── .backups/     每次发布前的版本备份（回滚用）
└── .npm-cache/   npm 缓存（避免写入 ~/.npm）
```

原则：**源码和发布目录分开，源码不对外**；`dist/` 里只放构建产物，不手工放文件。

## 3. 服务器环境要求

| 组件 | 要求 | 说明 |
| --- | --- | --- |
| git | 任意 | 用于拉取代码 |
| Node | ≥ 20.19 或 ≥ 22.12 | 建议 22 LTS；宝塔「Node.js 版本管理器」安装 |
| npm | 随 Node | 构建依赖安装 |
| rsync | 建议安装 | 没有时 `deploy.sh` 会退化为 tar 全量覆盖，仍可用 |
| 宝塔 | WebHook 插件、站点 root 指向 `dist` | 面板端口需对 Gitee 可达 |

## 4. 触发配置（一次性）

### 4.1 宝塔 WebHook 插件脚本

```bash
NODE_BIN_DIR=/www/server/nodejs/v22.20.0/bin \
NPM_CACHE_DIR=/www/wwwroot/music-score/.npm-cache \
BACKUP_DIR=/www/wwwroot/music-score/.backups \
SITE_OWNER=www:www \
  bash /www/wwwroot/music-score/src/deploy/server-hook.sh
```

> `NODE_BIN_DIR` 换成实际 Node 路径；`WEB_ROOT` 不传时默认就是仓库同级的 `dist`。

### 4.2 Gitee 侧

仓库 → **管理** → **WebHooks** → 添加：

- URL：宝塔 WebHook 插件生成的地址
- 事件：勾选 **Push**

### 4.3 宝塔站点

- 网站目录：`/www/wwwroot/music-score/dist`
- 运行目录：`/`
- nginx 伪静态 / 配置片段见 [deploy/nginx-spa.conf](deploy/nginx-spa.conf)：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}

location = /index.html {
    add_header Cache-Control "no-store";
}

location ~* \.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|avif|ico)$ {
    expires 30d;
    access_log off;
}
```

## 5. 日常发布流程

```bash
# 1. 本地改代码、自测
npm test
npm run build

# 2. 提交并推送（push 才会触发部署，本地 commit 不会）
git add -A
git commit -m "feat: xxx"
git push origin master

# 3. 等待约 20 秒，然后验证
curl -s http://music.kqhsxt.cn/ | grep -oE 'assets/[^"]+'
ls /www/wwwroot/music-score/dist/assets
```

两边 `assets` 哈希一致即说明新版本已上线；浏览器用无痕窗口或强制刷新确认。

### 手动部署（不想等 push / 排查问题）

```bash
cd /www/wwwroot/music-score/src
NPM_CACHE_DIR=/www/wwwroot/music-score/.npm-cache \
BACKUP_DIR=/www/wwwroot/music-score/.backups \
SITE_OWNER=www:www \
  bash deploy/server-hook.sh
```

## 6. 回滚

每次发布前会自动备份上一版到 `BACKUP_DIR`（默认保留最近 5 份，`BACKUP_KEEP` 可调）：

```bash
ls -lt /www/wwwroot/music-score/.backups/
tar xzf /www/wwwroot/music-score/.backups/release-YYYYmmdd-HHMMSS-*.tgz \
  -C /www/wwwroot/music-score/dist
```

也可以直接 revert 出问题的提交再 push，自动部署会回到旧版本代码。

## 7. 排查顺序

1. **Gitee 显示 200 ≠ 部署成功**：返回 200 只代表 WebHook 收到了请求，一定要看宝塔 WebHook 插件的日志确认脚本输出。
2. **构建失败**常见原因：
   - 找不到 `npm` / `node` → 配置 `NODE_BIN_DIR`
   - Node 版本过低 → 升级到 ≥ 20.19 或 ≥ 22.12
   - `dist` 里有宝塔写入的 `.user.ini` → 新版 `server-hook.sh` 已自动递归清理
3. **页面不更新**：
   - 先对比线上 `assets` 哈希和 `dist/assets` 是否一致
   - 域名前面有腾讯云 EdgeOne CDN，必要时刷新 `/` 与 `/index.html` 缓存
   - `index.html` 已配置 `no-store`，正常刷新即可
4. **403 / 404**：
   - 站点 `root` 是否指向 `music-score/dist`
   - 文件属主是否为 `www:www`
   - 是否加了 `try_files ... /index.html`

## 8. 约定与注意事项

- **不要在服务器上直接改代码**：部署脚本会执行 `git reset --hard origin/master`，服务器上的改动会被覆盖。
- **`WEB_ROOT` 不能指向仓库内部**：`server-hook.sh` 会拒绝，避免 `rsync --delete` 误删源码。
- **不要手工往 `dist/` 放文件**：每次发布都会覆盖，非构建产物会被清掉。
- **`ssh` 到服务器排查时**先看两处日志：宝塔 WebHook 插件日志、`/www/wwwlogs/music.kqhsxt.cn.error.log`。
- 宝塔「防跨站攻击」可能往站点目录写 `.user.ini`，`deploy.sh` 会保留它；纯静态站可在站点设置里关闭该功能。

## 9. 相关文件

| 文件 | 用途 |
| --- | --- |
| [`deploy/server-hook.sh`](deploy/server-hook.sh) | CI 入口：拉代码 → 构建 → 发布 |
| [`deploy/deploy.sh`](deploy/deploy.sh) | 发布脚本：备份 → 同步 → 权限 |
| [`deploy/nginx-spa.conf`](deploy/nginx-spa.conf) | nginx 配置片段 |