#!/bin/bash

####################################################################
##### Updates all services with registry token
####################################################################

# curl -sSL https://raw.githubusercontent.com/caprover/caprover/master/dev-scripts/add-registry-to-all-services.sh | bash -s -- 


all_services=$(docker service ls --format {{.Name}})
for srv in $all_services
do
  echo "Service: $srv"
  docker service update --with-registry-auth $srv  --label-add "registry-added" --force --detach
done