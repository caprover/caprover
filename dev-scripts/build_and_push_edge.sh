#!/bin/sh

docker build -t caprover/caprover-edge:latest -f dockerfile-captain.edge .
docker push caprover/caprover-edge:latest
