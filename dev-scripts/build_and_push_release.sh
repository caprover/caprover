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

if ! [ $(id -u) = 0 ]; then
   echo "Must run as sudo or root"
   exit 1
fi

# BRANCH=$(git rev-parse --abbrev-ref HEAD)
# On Github the line above does not work, instead:
echo Reserved for REPO_NAME=${GITHUB_REPOSITORY##*/}
echo GITHUB_REF=${GITHUB_REF}
echo EXTRACT_GITHUB_REF=${GITHUB_REF##*/}
echo EXTRACT_GITHUB_REF_HEADS=$(echo ${GITHUB_REF#refs/heads/})
BRANCH=${GITHUB_REF##*/}

echo "on branch $BRANCH"
if [[ "$BRANCH" != "testing-release" ]]; then
    echo 'Not on release branch! Aborting script!';
    exit 1;
fi


git clean -fdx .
npm ci
npm run build

node ./dev-scripts/validate-build-version-docker-hub.js

source ./version

docker build -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest -f dockerfile-captain.release .
docker push  $IMAGE_NAME:$CAPROVER_VERSION
docker push  $IMAGE_NAME:latest

