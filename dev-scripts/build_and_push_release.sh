#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x 

pwd


IMAGE_NAME=caprover/caprover

if [ ! -f ./package-lock.json ]; then
    echo "package-lock.json not found!"
    exit 1;
fi


# BRANCH=$(git rev-parse --abbrev-ref HEAD)
# On Github the line above does not work, instead:
BRANCH=${GITHUB_REF##*/}
echo "on branch $BRANCH"
if [[ "$BRANCH" != "release" ]]; then
    echo 'Not on release branch! Aborting script!';
    exit 1;
fi


git clean -fdx .
npm ci
npm run build

node ./dev-scripts/validate-build-version-docker-hub.js

source ./version

export DOCKER_CLI_EXPERIMENTAL=enabled
docker buildx ls
docker buildx create --name mybuilder
docker buildx use mybuilder

docker buildx build --platform linux/amd64,linux/arm64,linux/arm -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest -f dockerfile-captain.release --push .