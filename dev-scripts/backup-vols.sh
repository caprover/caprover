#!/bin/bash

# curl -sSL https://raw.githubusercontent.com/caprover/caprover/master/dev-scripts/backup-vols.sh | bash -s -- backup

usage() {
  >&2 echo "Usage: backup-vols.sh <backup|restore>"
  exit 1
}

backup() {
    backup_directory=/backup-vols/$(date +%Y_%m_%d_%H_%M_%S)

    mkdir -p $backup_directory

    vols=$(docker volume ls --quiet)

    for VOL_NAME_TO_BACKUP in $vols
    do
      echo "Volume: $VOL_NAME_TO_BACKUP"
      docker run --rm -v $VOL_NAME_TO_BACKUP:/volume -v $backup_directory:/backup alpine \
        tar -cf /backup/$VOL_NAME_TO_BACKUP.tar -C /volume ./
      echo ================================
    done
}

restore() {
    restore_dir=/restore-vols

    if [ -z "$(ls -A /$restore_dir)" ]; then
       >&2 echo "$restore_dir is empty or missing, check if you specified a correct name"
       exit 1
    fi

    vols=$(docker volume ls --quiet)

    for VOL_NAME_TO_BACKUP in $vols
    do
      echo "Volume: $VOL_NAME_TO_BACKUP"
      docker run --rm -v $VOL_NAME_TO_BACKUP:/volume -v $restore_dir:/backup alpine \
          sh -c "rm -rf /volume/* /volume/..?* /volume/.[!.]* ; tar -C /volume/ -xf /backup/$VOL_NAME_TO_BACKUP.tar.gz"
      echo ================================
    done
}

if [ $# -ne 1 ]; then
    usage
fi

# https://stackoverflow.com/questions/36273665/what-does-set-x-do
set -x





### STEP 1: turning off all services to avoid data corruption

all_services=$(docker service ls --format {{.Name}})
for srv in $all_services
do
  echo "Service: $srv"
  docker service scale $srv=0 -d
done

echo "Turning off all services..."
echo "Waiting 10 seconds until all services are scaled to zero..."
sleep 10



### STEP 2: Creating the backup or restoring from the backup

OPERATION=$1
case "$OPERATION" in
"backup" )
backup
;;
"restore" )
restore
;;
* )
usage
;;
esac



### STEP 3: turning on all services that we disabled in STEP 1

echo "Turning on all services..."

for srv in $all_services
do
  echo "Service: $srv"
  docker service scale $srv=1 -d
done


set +x