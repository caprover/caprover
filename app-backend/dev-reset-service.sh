#!/bin/sh

sudo docker service update captain-captain --force
sleep 2s
sudo docker service logs captain-captain --follow
