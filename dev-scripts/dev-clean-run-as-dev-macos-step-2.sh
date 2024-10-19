#!/bin/sh

if ! [ $(id -u) ] <>0; then
   echo "Must not be run as sudo or root on macos (macos security) please run the step 1 as root and this step as standard user"
   exit 1
fi

pwd >currentdirectory
docker service rm $(docker service ls -q)
sleep 1
docker secret rm captain-salt
docker build -t captain-debug -f dockerfile-captain.debug .
docker build -t caprover-goaccess -f ./dockerfiles/goaccess .
docker run \
   -e "CAPTAIN_IS_DEBUG=1" \
   -e "MAIN_NODE_IP_ADDRESS=127.0.0.1" \
   -v /var/run/docker.sock:/var/run/docker.sock \
   -v /captain:/captain \
   -v $(pwd):/usr/src/app captain-debug
sleep 2s
docker service logs captain-captain --follow
