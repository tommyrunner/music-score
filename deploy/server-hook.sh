#!/usr/bin/env bash
#
# 弦间 · 宝塔 WebHook 入口脚本（方案 B：服务器本地打包部署）
#
# 收到 Gitee push 通知后依次执行：
#   拉取代码 → 安装依赖 → 构建 → 调用 deploy.sh 发布到站点目录
#
# 宝塔「WebHook」插件里的执行脚本填：
#   bash /www/wwwroot/music-score-src/deploy/server-hook.sh
#
# 可用环境变量（都有默认值）：
#   REPO_DIR       代码仓库目录，默认脚本所在仓库根目录
#   BRANCH         部署分支，默认 master
#   WEB_ROOT       站点根目录，默认 /www/wwwroot/music-score
#   NODE_BIN_DIR   Node 的 bin 目录；不设置时会自动探测宝塔 Node 版本管理器目录
#   NPM_REGISTRY   npm 源，默认 https://registry.npmmirror.com
#   SITE_OWNER     发布后文件所有者，宝塔一般是 www:www
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
BRANCH="${BRANCH:-master}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/music-score}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
SITE_OWNER="${SITE_OWNER:-www:www}"

die() {
  printf '[server-hook] 错误：%s\n' "$1" >&2
  exit 1
}

info() {
  printf '[server-hook] %s\n' "$1"
}

if [[ -n "${NODE_BIN_DIR:-}" ]]; then
  export PATH="$NODE_BIN_DIR:$PATH"
fi

# 宝塔 Node 版本管理器把不同版本放在 /www/server/nodejs/<version>/bin
if ! command -v npm >/dev/null 2>&1; then
  for candidate in /www/server/nodejs/*/bin; do
    [[ -d "$candidate" ]] || continue
    if [[ -x "$candidate/npm" ]]; then
      export PATH="$candidate:$PATH"
    fi
  done
fi

command -v git >/dev/null 2>&1 || die "服务器没有安装 git"
command -v npm >/dev/null 2>&1 || die "找不到 npm，请先在宝塔安装 Node，并设置 NODE_BIN_DIR"

cd "$REPO_DIR"
[[ -f package.json ]] || die "$REPO_DIR 不是项目根目录（找不到 package.json）"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$REPO_DIR 不是 git 仓库"

# 避免两次部署并发执行；系统没有 flock 时跳过加锁
LOCK_FILE="/tmp/music-score-deploy.lock"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "上一次部署还在进行中，稍后再试"
fi

info "开始部署（分支 ${BRANCH}）"
git fetch --prune origin
if ! git checkout -q "$BRANCH"; then
  git checkout -q -B "$BRANCH" "origin/$BRANCH"
fi
git reset --hard "origin/$BRANCH"
info "当前提交：$(git log -1 --format='%h %s')"

info "安装依赖"
npm ci --include=dev --no-audit --no-fund --registry="$NPM_REGISTRY"

info "清理旧构建产物"
# 宝塔「防跨站攻击」可能把 .user.ini 写进站点目录；若站点目录曾指向 dist/，
# 这个文件会残留并导致 Vite 清空 outDir 时报 ENOTDIR。它通常带 immutable 属性。
if [[ -f "$REPO_DIR/dist/.user.ini" ]]; then
  if command -v chattr >/dev/null 2>&1; then
    chattr -i "$REPO_DIR/dist/.user.ini" 2>/dev/null || true
  fi
fi
rm -rf "$REPO_DIR/dist"

info "构建"
npm run build

info "发布到 $WEB_ROOT"
SITE_OWNER="$SITE_OWNER" \
DEPLOY_LABEL="$(git rev-parse --short HEAD)" \
  bash "$REPO_DIR/deploy/deploy.sh" "$REPO_DIR/dist" "$WEB_ROOT"

info "部署完成"