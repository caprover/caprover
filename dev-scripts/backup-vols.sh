#!/bin/bash

# This may cause data corruption if your volumes are in active use!!

mkdir -p /backup-vols

vols=$(docker volume ls --quiet)

for vol in $vols
do
  echo "Volume: $vol"
  pathToMount=($(docker volume inspect $vol --format {{.Mountpoint}}))
  tar -cf /backup-vols/$vol-$(date +%Y_%m_%d_%H_%M_%S).tar -C $pathToMount .
  echo ================================
done
