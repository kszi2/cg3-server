#!/usr/bin/bash

docker build . -t kisbogdan/cg3-backend -f Dockerfile-backend
docker build . -t kisbogdan/cg3-worker -f Dockerfile-worker
docker build . -t kisbogdan/cg3-checker -f Dockerfile-checker
