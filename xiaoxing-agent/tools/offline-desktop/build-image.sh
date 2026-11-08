#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${OFFLINE_IMAGE_OUTPUT:?Set OFFLINE_IMAGE_OUTPUT to the output .tar.xz path}"
# Requires an ARM64 build host, or a Docker builder configured for ARM64 execution.
docker buildx build --platform linux/arm64 --load -t xiaoxing-desktop:0.5.0 -f tools/offline-desktop/Dockerfile .
desktop_container=$(docker create xiaoxing-desktop:0.5.0 /bin/true)
trap 'docker rm "$desktop_container" >/dev/null' EXIT
docker export "$desktop_container" | xz -T2 -6 > "$OFFLINE_IMAGE_OUTPUT"
sha256sum "$OFFLINE_IMAGE_OUTPUT"
