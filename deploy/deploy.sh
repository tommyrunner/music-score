#!/usr/bin/env bash
#
# 弦间 · 静态站点发布脚本
#
# 作用：把 `npm run build` 产出的 dist/ 同步到宝塔站点根目录，
#      发布前备份上一版，发布后清理过期备份。
#
# 用法：
#   bash deploy/deploy.sh [dist 目录] [站点根目录]
#
# 也可以用环境变量传参（位置参数优先级更高）：
#   WEB_ROOT      站点根目录，例如 /www/wwwroot/score.example.com（必填）
#   BACKUP_DIR    备份目录，默认：站点根目录同级的 .music-score-backups
#   BACKUP_KEEP   保留几份备份，默认 5；设为 0 表示不清理
#   SITE_OWNER    发布后 chown 的用户:用户组，宝塔一般是 www:www；留空则不修改
#   DEPLOY_LABEL  发布标识（提交号等），只用于日志输出
#   SKIP_BACKUP   设为 1 时跳过发布前备份
#   USE_RSYNC     设为 0 时强制走 tar 覆盖发布（默认有 rsync 就用 rsync）
#
# 示例：
#   WEB_ROOT=/www/wwwroot/score.example.com SITE_OWNER=www:www \
#     bash deploy/deploy.sh dist /www/wwwroot/score.example.com
set -euo pipefail
umask 022

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DIST_DIR="${1:-${DIST_DIR:-$REPO_ROOT/dist}}"
WEB_ROOT="${2:-${WEB_ROOT:-}}"

die() {
  printf '[deploy] 错误：%s\n' "$1" >&2
  exit 1
}

info() {
  printf '[deploy] %s\n' "$1"
}

[[ -n "$WEB_ROOT" ]] || die "未指定站点根目录，请传第二个参数或设置 WEB_ROOT"

[[ -d "$DIST_DIR" ]] || die "找不到构建目录：$DIST_DIR"
DIST_DIR="$(cd "$DIST_DIR" && pwd)"
[[ -f "$DIST_DIR/index.html" ]] || die "$DIST_DIR 里没有 index.html，请先执行 npm run build"

mkdir -p "$WEB_ROOT"
WEB_ROOT="$(cd "$WEB_ROOT" && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$WEB_ROOT")/.music-score-backups}"
BACKUP_KEEP="${BACKUP_KEEP:-5}"
[[ "$BACKUP_KEEP" =~ ^[0-9]+$ ]] || die "BACKUP_KEEP 必须是数字"

if [[ "${SKIP_BACKUP:-0}" != "1" && -f "$WEB_ROOT/index.html" ]]; then
  mkdir -p "$BACKUP_DIR"
  backup_file="$BACKUP_DIR/release-$(date +%Y%m%d-%H%M%S)-$$.tgz"
  tar czf "$backup_file" -C "$WEB_ROOT" .
  info "已备份上一版：$backup_file"

  if (( BACKUP_KEEP > 0 )); then
    while IFS= read -r old_backup; do
      [[ -n "$old_backup" ]] && rm -f "$old_backup"
    done < <(ls -1t "$BACKUP_DIR"/release-*.tgz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))")
  fi
fi

if [[ "${USE_RSYNC:-1}" != "0" ]] && command -v rsync >/dev/null 2>&1; then
  # --checksum：按内容比对，避免同大小同时间戳时漏更新
  # --exclude .user.ini：这是宝塔生成的防跨站文件，要保留
  rsync -a --checksum --delete --exclude '.user.ini' "$DIST_DIR"/ "$WEB_ROOT"/
else
  info "未检测到 rsync，改用 tar 覆盖发布（建议安装 rsync 以获得增量同步）"
  find "$WEB_ROOT" -mindepth 1 -maxdepth 1 ! -name '.user.ini' -exec rm -rf {} +
  ( cd "$DIST_DIR" && tar cf - . ) | ( cd "$WEB_ROOT" && tar xf - )
fi

[[ -f "$WEB_ROOT/index.html" ]] || die "发布后没有找到 index.html，请检查站点目录是否被正确写入"

if [[ -n "${SITE_OWNER:-}" ]]; then
  chown -R "$SITE_OWNER" "$WEB_ROOT" 2>/dev/null \
    || info "警告：chown $SITE_OWNER 失败，请确认用户是否存在"
fi

find "$WEB_ROOT" -type d -exec chmod 755 {} + 2>/dev/null || true
find "$WEB_ROOT" -type f -exec chmod 644 {} + 2>/dev/null || true

file_count="$(find "$WEB_ROOT" -type f | wc -l | tr -d ' ')"
total_size="$(du -sh "$WEB_ROOT" 2>/dev/null | awk '{print $1}')"
info "发布完成：$file_count 个文件，共 ${total_size:-未知大小}"
if [[ -n "${DEPLOY_LABEL:-}" ]]; then
  info "发布标识：$DEPLOY_LABEL"
fi