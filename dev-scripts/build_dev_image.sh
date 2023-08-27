#!/bin/bash

# Exit early if any command fails
set -e

sudo echo OK

mkdir temp-frontend || echo OK

rm -rf temp-frontend/*

cp -r ../caprover-frontend/* ./temp-frontend

rm -rf ./temp-frontend/node_modules
rm -rf ./temp-frontend/.git

pwd

sudo docker build -f dockerfile-captain.dev -t caprover-dev-image:0.0.1 .