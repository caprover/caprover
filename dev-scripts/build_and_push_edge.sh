#!/bin/sh

date > .cachebust
docker build -t caprover/caprover-edge:latest -f dockerfile-captain.edge .
docker tag caprover/caprover-edge:latest caprover/caprover-edge:0.0.1
docker push caprover/caprover-edge:latest
docker push caprover/caprover-edge:0.0.1
