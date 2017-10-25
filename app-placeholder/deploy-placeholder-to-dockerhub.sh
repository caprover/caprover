#!/bin/sh


APP_PLACEHOLDER_IMAGE_NAME="dockersaturn/app-placeholder"

echo "Deploying to Docker hub ..."

 docker build -t $APP_PLACEHOLDER_IMAGE_NAME .

 docker tag $APP_PLACEHOLDER_IMAGE_NAME $APP_PLACEHOLDER_IMAGE_NAME:latest

 docker push $APP_PLACEHOLDER_IMAGE_NAME:latest
 docker push $APP_PLACEHOLDER_IMAGE_NAME
