#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x

pwd

# ensure you're not running it on local machine
if [ -z "$CI" ] || [ -z "$GITHUB_REF" ]; then
    echo "Running on a local machine! Exiting!"
    exit 127
else
    echo "Running on CI"
fi

CAPROVER_VERSION=0.0.1
IMAGE_NAME=caprover/caprover-edge

if [ ! -f ./package-lock.json ]; then
    echo "package-lock.json not found!"
    exit 1
fi

# BRANCH=$(git rev-parse --abbrev-ref HEAD)
# On Github the line above does not work, instead:
BRANCH=${GITHUB_REF##*/}
echo "on branch $BRANCH"
if [[ "$BRANCH" != "master" ]]; then
    echo 'Not on master branch! Aborting script!'
    exit 1
fi

## Building frontend app
ORIG_DIR=$(pwd)
FRONTEND_DIR=/home/runner/app-frontend
curl -Iv https://registry.yarnpkg.com/
mkdir -p $FRONTEND_DIR && cd $FRONTEND_DIR
git clone https://github.com/githubsaturn/caprover-frontend.git
cd caprover-frontend
git log --max-count=1
yarn install --no-cache --frozen-lockfile --network-timeout 600000
echo "Installation finished"
yarn run build
echo "Building finished"
cd $ORIG_DIR
mv $FRONTEND_DIR/caprover-frontend/build ./dist-frontend

sudo apt-get update && sudo apt-get install qemu-user-static
# docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker run --rm --privileged tonistiigi/binfmt --install all
# export DOCKER_CLI_EXPERIMENTAL=enabled
docker buildx ls
docker buildx rm mybuilder || echo "mybuilder not found"
docker buildx create --name mybuilder
docker buildx use mybuilder

# docker buildx build --platform linux/arm -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest  -f dockerfile-captain.edge --push .
docker buildx build --platform linux/amd64,linux/arm64,linux/arm -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest -f dockerfile-captain.edge --push .

# docker build -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest  -f dockerfile-captain.edge .
# docker push $IMAGE_NAME:latest
# docker push $IMAGE_NAME:$CAPROVER_VERSION
