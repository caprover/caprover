#!/bin/sh

CERTBOT_VERSION_DOCKERFILE="v0.29.1"


SLEEPING_CERT_BOT_IMAGE_NAME="dockersaturn/certbot-sleeping"

echo "Deploying to Docker hub - certbot version: $CERTBOT_VERSION_DOCKERFILE"

echo "FROM certbot/certbot:$CERTBOT_VERSION_DOCKERFILE\n ENTRYPOINT [\"/bin/sh\",\"-c\" ]  \n CMD [\"sleep 9999d\"] \n" | \
 docker build -t $SLEEPING_CERT_BOT_IMAGE_NAME:latest \
 -t $SLEEPING_CERT_BOT_IMAGE_NAME:$CERTBOT_VERSION_DOCKERFILE -


 docker push $SLEEPING_CERT_BOT_IMAGE_NAME:latest
 docker push $SLEEPING_CERT_BOT_IMAGE_NAME:$CERTBOT_VERSION_DOCKERFILE
