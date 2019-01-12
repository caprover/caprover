#!/bin/sh

# Run this script on the server to migrate from CaptainDuckDuck.


cd / && \
docker service scale captain-captain=0 && \
(docker service rm captain-certbot captain-nginx captain-registry || true) && \
sleep 3s && echo "waiting." && sleep 3s && echo "waiting..." && \
rm -rf /captain/generated && rm -rf /captain/temp && \
tar -czvf /captain-bk-$(date +%Y_%m_%d_%H_%M_%S).tar /captain && \
mkdir -p /captain/data && \
mv /captain/letencrypt /captain/data/ && \
mv /captain/nginx-shared /captain/data/ && \
mv /captain/registry /captain/data/ && \
mv /captain/config.conf /captain/data/ && \
docker service update --image caprover/caprover captain-captain && \
docker service scale captain-captain=1 && \
docker service logs captain-captain --follow