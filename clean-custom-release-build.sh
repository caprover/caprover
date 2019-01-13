#!/bin/sh

if ! [ $(id -u) = 0 ]; then
   echo "Must run as sudo or root"
   exit 1
fi

docker build -t captain-custom-release-build -f dockerfile-captain.release .

mkdir /captain

if docker service ps captain-captain ; then
    echo "captain-captain service already exists. Trying to update it..."
else
    echo "Installing CapRover..."
    docker run \
       -v /var/run/docker.sock:/var/run/docker.sock \
       captain-custom-release-build
fi

sleep 5s
docker service update --image captain-custom-release-build captain-captain
