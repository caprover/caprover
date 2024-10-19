#!/bin/bash

sudo apt-get update && sudo apt-get install qemu-user-static

# export DOCKER_CLI_EXPERIMENTAL=enabled
# docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

docker run --rm --privileged tonistiigi/binfmt --install all
docker buildx ls
docker buildx rm mybuilder || echo "mybuilder not found"
docker buildx create --name mybuilder
docker buildx use mybuilder

docker buildx build --platform linux/amd64,linux/arm64,linux/arm -t my-test-image -f test-dockerfile.edge --load .
