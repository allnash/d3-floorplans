#!/usr/bin/env bash
# Commit the 1.0.0 rewrite, tag it, and push branch + tag to GitHub.
# Usage: ./push.sh [version]   (default: version from package.json)
set -euo pipefail

cd "$(dirname "$0")"

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"

echo "==> Verifying build before release"
npm run typecheck
npm test
npm run build

echo "==> Committing"
git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -m "Rewrite as d3-floorplan ${VERSION}

- Framework-agnostic TypeScript core on D3 v7 modules with full
  enter/update/exit rendering, working pan/zoom (fixes #2), polygon
  drawing, drag editing, selection, keyboard and context menu
- React component and useFloorState hook under d3-floorplan/react (fixes #3)
- Embeddable IIFE bundle exposing window.Floorplan
- motion.dev animations
- SVG office floor plans, demo site and vanilla example
- Vite build, vitest tests, CI, Pages deploy and npm release workflows"
fi

echo "==> Tagging ${TAG}"
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Tag ${TAG} already exists, skipping."
else
  git tag -a "${TAG}" -m "${TAG}"
fi

echo "==> Pushing"
git push origin master
git push origin "${TAG}"

echo
echo "Done. The tag push triggers .github/workflows/release.yml (npm publish),"
echo "which needs an NPM_TOKEN repo secret. The master push triggers the Pages"
echo "deploy; set Settings > Pages > Source to 'GitHub Actions' once."
