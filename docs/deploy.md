# 自动打包部署（Gitee 流水线 + 宝塔面板）

本文档说明如何做到：**push 到 `master` 后自动构建并发布到宝塔服务器**。

## 整体链路

```
git push
   │
   ├─ 方案 A：Gitee 流水线（云端 Node 构建）
   │    push 触发 → Nodejs 构建（产出 dist/ 制品）→ 主机部署（Agent 下载制品到服务器）
   │                                                   → 执行 deploy/deploy.sh → 宝塔站点目录
   │
   └─ 方案 B：宝塔 WebHook（服务器本地构建）
        push 触发 → 宝塔 WebHook 执行 deploy/server-hook.sh
                  → git pull → npm ci → npm run build → deploy/deploy.sh → 宝塔站点目录
```

两种方案最终都调用 `deploy/deploy.sh`，行为一致：**发布前备份上一版、同步 `dist/`、保留宝塔的 `.user.ini`、清理过期备份**。

| 对比项 | 方案 A：Gitee 流水线 | 方案 B：宝塔 WebHook |
| --- | --- | --- |
| 构建位置 | Gitee 云端，不占服务器 CPU | 服务器本地 |
| 费用 | 免费版每月 1000 核分（1C2G 跑 5 分钟 = 5 核分） | 免费 |
| 依赖 | 需要「主机管理 / 主机组」，个人版账号可能看不到入口 | 只需要宝塔 WebHook 插件 |
| 适合 | 服务器配置低、想保留云端构建记录 | 不想折腾流水线、想最快跑通 |

> 先按方案 B 跑通，再按需要切换方案 A 也可以，两者共用同一个发布脚本。

## 前置条件

- 宝塔面板里已经建好站点并绑定域名，站点根目录记为 `$WEB_ROOT`，例如 `/www/wwwroot/score.example.com`。
- 服务器安装了 `rsync`（宝塔环境一般自带）：
  - CentOS：`yum install -y rsync`
  - Ubuntu/Debian：`apt install -y rsync`
- 仓库地址：`https://gitee.com/tommyrunner/music-score.git`
- Node 版本：**≥ 20.19 或 ≥ 22.12**（Vite 8 的要求，建议 22 LTS）。

---

## 方案 A：Gitee 流水线（云端构建）

### A1. 创建流水线

1. 打开 Gitee 仓库 → 顶部 **流水线** → **新建流水线**。
2. 选择 **Nodejs** 模板（或空白流水线后手动加任务）。
3. 配置流水线源：选择当前仓库，分支 `master`，触发方式选择 **代码更新自动触发（push）**。

### A2. 阶段 1：构建

添加任务，选择插件 **Nodejs 构建**，按下面填写：

- **Node 版本**：选 22.x
- **构建命令**：

  ```bash
  set -e
  npm ci --include=dev
  npm run build
  ```

- **暂存构建物**：
  - 唯一标识：`BUILD_ARTIFACT`
  - 打包文件/目录：`dist`、`deploy`
    （`deploy` 必须一起打包，部署阶段要用里面的 `deploy/deploy.sh`）

构建成功后，制品是一个 `tar.gz` 压缩包。

### A3. 添加部署主机

1. 进入 **企业管理 → 主机管理 → 新建主机组**（类型选「公网主机」）。
2. 复制页面给出的安装命令，在宝塔服务器上执行，把服务器纳管进主机组。
3. 把主机组关联到 `music-score` 仓库。

> 如果账号里找不到「主机管理」入口（常见于个人版），直接用**方案 B**。

### A4. 阶段 2：部署

添加任务，选择插件 **主机部署**：

- **执行主机组**：上一步的主机组
- **部署前下载上游产出**：
  - 部署文件名：`music-score.tar.gz`
  - 下载路径：`/www/wwwroot/.deploy`
  - 文件来源：构建产物 `BUILD_ARTIFACT`
- **部署脚本**：

  ```bash
  set -e
  ARTIFACT_DIR=/www/wwwroot/.deploy
  RELEASE_DIR=/www/wwwroot/.deploy/release
  SITE_ROOT=/www/wwwroot/score.example.com
  rm -rf "$RELEASE_DIR"
  mkdir -p "$RELEASE_DIR"
  tar zxf "$ARTIFACT_DIR/music-score.tar.gz" -C "$RELEASE_DIR"
  cd "$RELEASE_DIR"
  SITE_OWNER=www:www bash deploy/deploy.sh dist "$SITE_ROOT"
  ```

> 解压目录要和下载目录分开，否则清理旧版本时会把刚下载的制品一起删掉。
> 主机部署插件默认把制品下载到主机的 `~/gitee_go/deploy/` 下，具体路径以流水线日志为准；如果和上面不一致，按日志里的实际路径修改 `tar` 命令。
> `SITE_ROOT` 改成你自己的站点根目录。

### A5. 运行验证

保存流水线，点 **运行** 跑一次。成功后在浏览器刷新站点即可看到新版本；之后每次 push 到 `master` 都会自动部署。

---

## 方案 B：宝塔 WebHook（服务器本地构建）

### B1. 在服务器放一份仓库

```bash
cd /www/wwwroot
git clone https://gitee.com/tommyrunner/music-score.git music-score-src
cd music-score-src
```

> 私有仓库需要给服务器配置 Gitee 部署公钥，或把远程地址换成带 token 的 HTTPS 地址。
> 源码目录和站点目录要分开，**不要把仓库直接放在站点根目录**。
> 服务器上的这份仓库会执行 `git reset --hard origin/master`，不要在服务器上直接改代码，所有改动都从本地 push 上来。

### B2. 安装 Node

宝塔 → **软件商店** → **Node.js 版本管理器** → 安装 22.x，记下安装路径，例如 `/www/server/nodejs/v22.20.0/bin`。

### B3. 配置 WebHook

1. 宝塔 → **软件商店** → 安装 **WebHook** 插件。
2. 添加一个 Hook：
   - 名称：`music-score`
   - 执行脚本：

     ```bash
     export PATH=/www/server/nodejs/v22.20.0/bin:$PATH
     WEB_ROOT=/www/wwwroot/score.example.com \
     SITE_OWNER=www:www \
       bash /www/wwwroot/music-score-src/deploy/server-hook.sh
     ```

     也可以不写 `export PATH`，改用 `NODE_BIN_DIR=/www/server/nodejs/v22.20.0/bin` 传给脚本。
3. 保存后复制生成的 WebHook URL（形如 `http://服务器IP:端口/?token=xxxx`）。

### B4. 在 Gitee 配置 WebHook

1. 仓库 → **管理** → **WebHooks** → **添加**。
2. URL 填上一步拿到的地址，事件勾选 **Push**，添加后点「测试」确认返回成功。

### B5. 先手动跑一遍

在服务器上直接执行，确认脚本本身没问题：

```bash
bash /www/wwwroot/music-score-src/deploy/server-hook.sh
```

之后每次 push 都会由 WebHook 自动触发。

---

## 站点 nginx 配置

把 [`deploy/nginx-spa.conf`](../deploy/nginx-spa.conf) 合并进宝塔站点的配置文件（宝塔 → 网站 → 设置 → 配置文件）：

- `root` 指向发布目录（`$WEB_ROOT`）
- `location / { try_files $uri $uri/ /index.html; }` 保证前端路由刷新不 404
- `index.html` 不缓存，带哈希的静态资源长缓存

宝塔保存配置时会自动 reload nginx。

## 验证清单

1. `curl -I https://你的域名` 返回 200，且 `index.html` 为 `no-store`。
2. 页面能正常打开，刷新子路径不 404。
3. 发布后 `dist/assets/` 下新哈希文件已出现在站点目录。
4. 流水线 / WebHook 日志里能看到「发布完成：N 个文件」。

## 回滚

每次发布前的旧版本会备份到站点根目录同级的 `.music-score-backups/`：

```bash
ls -lt /www/wwwroot/.music-score-backups/
cd /www/wwwroot
tar xzf .music-score-backups/release-YYYYmmdd-HHMMSS-*.tgz \
  -C /www/wwwroot/score.example.com
```

也可以直接在 Gitee 上 revert 出问题的提交再 push，自动部署会回到旧版本代码。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| push 后流水线没触发 | 确认触发方式为 push、分支为 `master`，且推送的确实是 `master` |
| 主机部署失败 | 检查主机 Agent 是否在线；按流水线日志里的制品实际下载路径修正 `tar` 命令；确认制品包含 `deploy/` |
| 找不到 npm / node | 设置 `NODE_BIN_DIR` 指向宝塔 Node 的 `bin` 目录 |
| 构建报 Node 版本不满足 | Node 升级到 ≥20.19 或 ≥22.12 |
| 页面刷新 404 | 站点 nginx 未加 `try_files ... /index.html` |
| 静态资源 404 | 站点 `root` 没有指向发布目录，或发布脚本的 `WEB_ROOT` 配错 |
| 403 Forbidden | 站点文件属主不对：`SITE_OWNER=www:www` 重新发布一次 |
| 更新后页面没变化 | 浏览器缓存或 CDN 缓存；`index.html` 已配置 `no-store`，通常强制刷新即可 |
| 流水线核分用完 | 免费额度每月 1000 核分；改用方案 B 或在 Gitee 控制台购买加时包 |

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `deploy/deploy.sh` | 通用发布脚本：备份 → 同步 `dist/` → 修正权限 |
| `deploy/server-hook.sh` | 宝塔 WebHook 入口：拉代码 → 构建 → 调用发布脚本 |
| `deploy/nginx-spa.conf` | 宝塔站点 nginx 配置片段（SPA 回退与缓存） |