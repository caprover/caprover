#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x

CHANNEL="${1:-}"

if [ "$#" -ne 1 ] || { [ "$CHANNEL" != "edge" ] && [ "$CHANNEL" != "release" ]; }; then
    echo "Usage: $0 <edge|release>"
    exit 1
fi

pwd

if [ ! -f ./package-lock.json ]; then
    echo "package-lock.json not found!"
    exit 1
fi

if [ "$CHANNEL" = "edge" ]; then
    EXPECTED_BRANCH=master
    CAPROVER_VERSION=0.0.1
    IMAGE_NAME=caprover/caprover-edge
    DOCKERFILE=release/dockerfile.edge
    FRONTEND_COMMIT_HASH=''
else
    EXPECTED_BRANCH=release
    IMAGE_NAME=caprover/caprover
    DOCKERFILE=release/dockerfile.release
    FRONTEND_COMMIT_HASH=c9005cc2e5ac1b6816cb983d2d3732338c546a94
fi

# Ensure publishing only happens from the expected GitHub Actions branch.
if [ -z "$CI" ] || [ -z "$GITHUB_REF" ]; then
    echo "Running on a local machine! Exiting!"
    exit 127
else
    echo "Running on CI"
fi

BRANCH=${GITHUB_REF##*/}
echo "on branch $BRANCH"
if [ "$BRANCH" != "$EXPECTED_BRANCH" ]; then
    echo "Not on $EXPECTED_BRANCH branch! Aborting script!"
    exit 1
fi

if [ "$CHANNEL" = "release" ]; then
    CAPROVER_VERSION="$(./release/validate-version.sh "$IMAGE_NAME")"
fi

## Building frontend app
ORIG_DIR=$(pwd)
FRONTEND_DIR=/home/runner/app-frontend

curl -Iv https://registry.yarnpkg.com/
mkdir -p "$FRONTEND_DIR"
git clone https://github.com/githubsaturn/caprover-frontend.git "$FRONTEND_DIR/caprover-frontend"
cd "$FRONTEND_DIR/caprover-frontend"
if [ -n "$FRONTEND_COMMIT_HASH" ]; then
    git reset --hard "$FRONTEND_COMMIT_HASH"
fi
git log --max-count=1
yarn install --no-cache --frozen-lockfile --network-timeout 600000
echo "Installation finished"
yarn run build
echo "Building finished"
cd "$ORIG_DIR"
mv "$FRONTEND_DIR/caprover-frontend/build" ./dist-frontend

sudo apt-get update && sudo apt-get install -y qemu-user-static
# docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker run --rm --privileged tonistiigi/binfmt --install all
# export DOCKER_CLI_EXPERIMENTAL=enabled
docker buildx ls
docker buildx rm mybuilder || echo "mybuilder not found"
docker buildx create --name mybuilder
docker buildx use mybuilder

docker buildx build --platform linux/amd64,linux/arm64 -t "$IMAGE_NAME:$CAPROVER_VERSION" -t "$IMAGE_NAME:latest" -f "$DOCKERFILE" --push .
