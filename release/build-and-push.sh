#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x

usage() {
    echo "Usage: $0 <edge|release> [--dry-run|--build-only]"
}

CHANNEL="${1:-}"
MODE=publish

if [ "$CHANNEL" != "edge" ] && [ "$CHANNEL" != "release" ]; then
    usage
    exit 1
fi

shift

case "${1:-}" in
    '') ;;
    --dry-run) MODE=dry-run ;;
    --build-only) MODE=build-only ;;
    *)
        usage
        exit 1
        ;;
esac

if [ "$#" -gt 1 ]; then
    usage
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
    FRONTEND_REF='default branch HEAD'
else
    EXPECTED_BRANCH=release
    IMAGE_NAME=caprover/caprover
    DOCKERFILE=release/dockerfile.release
    FRONTEND_COMMIT_HASH=c9005cc2e5ac1b6816cb983d2d3732338c546a94
    FRONTEND_REF="$FRONTEND_COMMIT_HASH"
fi

if [ "$MODE" = "publish" ]; then
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
fi

if [ "$CHANNEL" = "release" ]; then
    if [ "$MODE" = "publish" ]; then
        npm ci
        npm run build
        node ./release/validate-version.js
        source ./version
        git clean -fdx
    else
        CAPROVER_VERSION="$(sed -n "s/^[[:space:]]*version: '\([^']*\)',/\1/p" src/utils/CaptainConstants.ts)"
        if [ -z "$CAPROVER_VERSION" ]; then
            echo "Could not find the current CapRover version."
            exit 1
        fi
    fi
fi

echo "**************************************"
echo "$IMAGE_NAME:$CAPROVER_VERSION"
echo "Channel: $CHANNEL"
echo "Mode: $MODE"
echo "Frontend: $FRONTEND_REF"
echo "Dockerfile: $DOCKERFILE"
echo "**************************************"

if [ "$MODE" = "dry-run" ]; then
    echo "docker buildx build --platform linux/amd64,linux/arm64 -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest -f $DOCKERFILE --push ."
    exit 0
fi

## Building frontend app
ORIG_DIR=$(pwd)
if [ "$MODE" = "publish" ]; then
    FRONTEND_DIR=/home/runner/app-frontend
else
    FRONTEND_DIR=$(mktemp -d)
    trap 'rm -rf "$FRONTEND_DIR"' EXIT
fi

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
rm -rf "$ORIG_DIR/dist-frontend"
mv "$FRONTEND_DIR/caprover-frontend/build" ./dist-frontend

if [ "$MODE" = "build-only" ]; then
    docker buildx build --load -t "$IMAGE_NAME:$CAPROVER_VERSION" -t "$IMAGE_NAME:latest" -f "$DOCKERFILE" .
    exit 0
fi

sudo apt-get update && sudo apt-get install qemu-user-static
# docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker run --rm --privileged tonistiigi/binfmt --install all
# export DOCKER_CLI_EXPERIMENTAL=enabled
docker buildx ls
docker buildx rm mybuilder || echo "mybuilder not found"
docker buildx create --name mybuilder
docker buildx use mybuilder

docker buildx build --platform linux/amd64,linux/arm64 -t "$IMAGE_NAME:$CAPROVER_VERSION" -t "$IMAGE_NAME:latest" -f "$DOCKERFILE" --push .
