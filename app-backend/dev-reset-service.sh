#!/bin/sh

if ! [ $(id -u) = 0 ]; then
   echo "Must run as sudo or root"
   exit 1
fi

sudo docker service update captain-captain --force
sleep 2s
sudo docker service logs captain-captain --follow --since 10m
