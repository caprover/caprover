#!/bin/sh
# ./dev-shell-to-captain.sh captain-captain
docker exec -it $(docker container ls --filter name=$1 | awk 'FNR == 2 {print $1}') /bin/sh