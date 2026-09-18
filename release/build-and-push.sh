#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

CHANNEL="${1:-}"
PHASE="${2:-}"

if [ "$#" -ne 2 ] || { [ "$CHANNEL" != "edge" ] && [ "$CHANNEL" != "release" ]; } || \
    { [ "$PHASE" != "frontend" ] && [ "$PHASE" != "docker-setup" ] && [ "$PHASE" != "publish" ]; }; then
    echo "Usage: $0 <edge|release> <frontend|docker-setup|publish>"
    exit 1
fi

pwd

if [ ! -f ./package-lock.json ]; then
    echo "package-lock.json not found!"
    exit 1
fi

if [ "$CHANNEL" = "edge" ]; then
    EXPECTED_BRANCH=master
    IMAGE_TAG="${GITHUB_SHA:-}"
    IMAGE_NAME="$EDGE_IMAGE_NAME"
    DOCKERFILE=release/dockerfile.edge
    FRONTEND_COMMIT_HASH="$EDGE_FRONTEND_COMMIT"
else
    EXPECTED_BRANCH=release
    IMAGE_TAG="$CAPROVER_VERSION"
    IMAGE_NAME="$CAPROVER_IMAGE_NAME"
    DOCKERFILE=release/dockerfile.release
    FRONTEND_COMMIT_HASH="$RELEASE_FRONTEND_COMMIT"
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

if [ "$PHASE" = "frontend" ]; then
    if [ "$CHANNEL" = "release" ]; then
        ./release/validate-version.sh
    fi

    ORIG_DIR=$(pwd)
    FRONTEND_DIR=/home/runner/app-frontend

    curl -Iv https://registry.yarnpkg.com/
    mkdir -p "$FRONTEND_DIR"
    git clone "$FRONTEND_REPOSITORY" "$FRONTEND_DIR/caprover-frontend"
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
    exit 0
fi

if [ "$PHASE" = "docker-setup" ]; then
    docker run --rm --privileged \
        tonistiigi/binfmt@sha256:400a4873b838d1b89194d982c45e5fb3cda4593fbfd7e08a02e76b03b21166f0 \
        --install all
    docker buildx ls
    docker buildx rm mybuilder || echo "mybuilder not found"
    docker buildx create --name mybuilder
    docker buildx use mybuilder
    exit 0
fi

if [ "$CHANNEL" = "release" ]; then
    ./release/validate-version.sh
fi

if [ ! -d ./dist-frontend ]; then
    echo "dist-frontend not found!"
    exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
    echo "GITHUB_SHA is required when publishing the edge image!"
    exit 1
fi

DOCKER_TAGS=(-t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest")
if [ "$CHANNEL" = "edge" ]; then
    DOCKER_TAGS+=(-t "$IMAGE_NAME:$EDGE_VERSION")
fi

docker buildx build --platform linux/amd64,linux/arm64 "${DOCKER_TAGS[@]}" -f "$DOCKERFILE" --push .
