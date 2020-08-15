#!/bin/bash

# Exit early if any command fails
set -e

# Print all commands
set -x 

pwd

CAPROVER_VERSION=0.0.1
IMAGE_NAME=caprover/caprover-edge

if [ ! -f ./package-lock.json ]; then
    echo "package-lock.json not found!"
    exit 1;
fi


# BRANCH=$(git rev-parse --abbrev-ref HEAD)
# On Github the line above does not work, instead:
BRANCH=${GITHUB_REF##*/}
echo "on branch $BRANCH"
if [[ "$BRANCH" != "master" ]]; then
    echo 'Not on master branch! Aborting script!';
    exit 1;
fi










docker build -t $IMAGE_NAME:$CAPROVER_VERSION -t $IMAGE_NAME:latest -f dockerfile-captain.edge .
docker push  $IMAGE_NAME:$CAPROVER_VERSION
docker push  $IMAGE_NAME:latest
