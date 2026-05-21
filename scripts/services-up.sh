#!/usr/bin/env bash
set -e

# Kill any stale gvproxy left from a previous Podman session, then ensure the
# Podman machine is running before starting the backing services. Without this,
# docker-compose may connect to a zombie socket that lacks macOS filesystem
# access, causing bind-mount failures.
pkill -x gvproxy 2>/dev/null || true
podman machine start 2>/dev/null || true

docker-compose -f docker-compose.services.yml up -d
