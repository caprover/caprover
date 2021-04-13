#!/bin/bash

# Run the following line on a PlayWithDocker instance
#  curl -L https://pwd.caprover.com | bash

sleepWithTimer(){
    secs=${1}
    while [ $secs -gt 0 ]; do
        echo -ne "  Waiting $secs seconds... \033[0K\r"
        sleep 1
        : $((secs--))
    done
}

if [[ -z "${PWD_HOST_FQDN}" ]]; then
  echo "ERROR: this script is only meant to be used on play-with-docker.com environment" && exit 127
else
  echo "Installing and setting up CapRover on play-with-docker.com environment"
fi

docker run -e MAIN_NODE_IP_ADDRESS='127.0.0.1' -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock -v /captain:/captain caprover/caprover

IP_WITH_DASH=`ifconfig eth1 | grep 'inet addr' | cut -d: -f2 | awk '{print $1}'  | sed 's/\./-/g'`
##  ip172-18-0-34-bo5qqunad2eg00a35t5g-80.direct.labs.play-with-docker.com
CAPROVER_ROOT_DOMAIN="ip${IP_WITH_DASH}-${SESSION_ID}-80.direct.labs.play-with-docker.com"
echo "CapRover Root Domain: ${CAPROVER_ROOT_DOMAIN}"


echo "=============================================="
echo "=============================================="
echo "Waiting for CapRover to finish installation..."
echo "=============================================="
echo "=============================================="
echo " "
echo " "
echo " "
CAPTAIN_INITED=""
while [[ -z "${CAPTAIN_INITED}" ]];do 
    CAPTAIN_INITED=`docker service logs captain-captain --since 3s | grep "Captain is initialized"`
    docker service logs captain-captain --since 2s
    sleep 2 
done 

echo " "
echo " "
echo "Setting up the root URL... "
echo " "
docker service scale captain-captain=0
sleepWithTimer 6
echo "{
        \"namespace\": \"captain\",
        \"customDomain\": \"${CAPROVER_ROOT_DOMAIN}\"
}" > /captain/data/config-captain.json
cat /captain/data/config-captain.json
echo  "{\"skipVerifyingDomains\":\"true\"}" >  /captain/data/config-override.json
docker container prune --force
docker service scale captain-captain=1


echo "==================================="
echo "==================================="
echo "Waiting for CapRover to finalize..."
echo "==================================="
echo "==================================="
echo " "
echo " "
sleepWithTimer 6

CAPTAIN_INITED=""
while [[ -z "${CAPTAIN_INITED}" ]];do 
    CAPTAIN_INITED=`docker service logs captain-captain --since 3s | grep "Captain is initialized"`
    docker service logs captain-captain --since 2s
    sleep 2 
done 


echo " "
echo " "
echo " "
echo "==================================="
echo "==================================="
echo " **** Installation is done! *****  "
echo "CapRover is available at http://captain.${CAPROVER_ROOT_DOMAIN}"
echo "Default password is: captain42"
echo "==================================="
echo "==================================="

