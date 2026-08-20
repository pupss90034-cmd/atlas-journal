#!/bin/bash
# atlas-journal 一鍵發布：清鎖 → 加入變更 → commit → push
cd "$(dirname "$0")" || exit 1

echo "📂 $(pwd)"
echo "🔓 清理殘留鎖檔…"
rm -f .git/index.lock .git/config.lock .git/HEAD.lock \
      .git/objects/maintenance.lock .git/refs/heads/main.lock 2>/dev/null
find .git -name "*.lock" -maxdepth 3 -delete 2>/dev/null

MSG="$1"
if [ -z "$MSG" ]; then MSG="更新內容 $(date '+%Y-%m-%d %H:%M')"; fi

git add -A
if git diff --cached --quiet; then
  echo "✅ 沒有新變更，不需要發布。"
else
  git commit -m "$MSG" && git push origin main && echo "🚀 發布完成！網站約 1 分鐘後更新。"
fi

echo ""
echo "（按任意鍵關閉視窗）"
read -n 1 -s
