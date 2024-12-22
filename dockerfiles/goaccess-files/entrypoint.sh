#!/bin/sh

env >> /etc/environment

# execute CMD
echo "$@"
exec "$@"