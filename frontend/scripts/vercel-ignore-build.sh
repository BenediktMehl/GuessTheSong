#!/bin/bash
# Ignore build step for branches other than main
# This script should be used in Vercel Dashboard > Settings > Build & Development Settings > Ignored Build Step
# Or you can set it via Vercel CLI: vercel env add VERCEL_GIT_COMMIT_REF

if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  echo "Skipping build for branch: $VERCEL_GIT_COMMIT_REF"
  exit 0
fi

echo "Building for branch: $VERCEL_GIT_COMMIT_REF"
exit 1

