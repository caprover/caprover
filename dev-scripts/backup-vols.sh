#!/bin/bash

# https://stackoverflow.com/questions/36273665/what-does-set-x-do
set -x


### STEP 1: turning off all services to avoid data corruption

all_services=$(docker volume ls --quiet)
for srv in $all_services
do
  echo "Service: $srv"
  docker service scale $srv=0 -d
done

echo "Turning off all services..."
echo "Waiting 10 seconds until all services are scaled to zero..."
sleep 10





### STEP 2: Creating the backup

backup_directory=/backup-vols/$(date +%Y_%m_%d_%H_%M_%S)

mkdir -p $backup_directory

vols=$(docker volume ls --quiet)

for VOL_NAME_TO_BACKUP in $vols
do
  echo "Volume: $VOL_NAME_TO_BACKUP"
  docker run -it --rm -v $VOL_NAME_TO_BACKUP:/volume -v $backup_directory:/backup alpine \
    tar -cf /backup/$VOL_NAME_TO_BACKUP.tar -C /volume ./
  echo ================================
done





### STEP 3: turning on all services that we disabled in STEP 1

echo "Turning on all services..."

for srv in $all_services
do
  echo "Service: $srv"
  docker service scale $srv=1 -d
done


set +x