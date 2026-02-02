#!/usr/bin/env bash
set -e

echo "⏳ Checking Docker containers health..."

# Containers
POSTGRES_CONTAINER=dw-postgres
REDIS_CONTAINER=dw-redis

# Fail fast if containers do not exist
if [ -z "$(docker ps -a --filter "name=$POSTGRES_CONTAINER" --format '{{.Names}}')" ]; then
	echo "❌ $POSTGRES_CONTAINER does not exist. Run 'pnpm infra:up' first."
	exit 1
fi

if [ -z "$(docker ps -a --filter "name=$REDIS_CONTAINER" --format '{{.Names}}')" ]; then
	echo "❌ $REDIS_CONTAINER does not exist. Run 'pnpm infra:up' first."
	exit 1
fi

# Fail fast if containers are not running
POSTGRES_RUNNING=$(docker inspect -f '{{.State.Running}}' $POSTGRES_CONTAINER)
REDIS_RUNNING=$(docker inspect -f '{{.State.Running}}' $REDIS_CONTAINER)

if [ "$POSTGRES_RUNNING" != "true" ]; then
	echo "❌ $POSTGRES_CONTAINER is not running. Run 'pnpm infra:up'."
	exit 1
fi

if [ "$REDIS_RUNNING" != "true" ]; then
	echo "❌ $REDIS_CONTAINER is not running. Run 'pnpm infra:up'."
	exit 1
fi

# Wait for healthchecks to pass (optional, short wait)
echo "⏳ Waiting for $POSTGRES_CONTAINER to be healthy..."
docker run --rm --network dw-network postgres:16 \
	bash -c "until pg_isready -h $POSTGRES_CONTAINER -U $POSTGRES_USER; do sleep 1; done"

echo "⏳ Waiting for $REDIS_CONTAINER to be healthy..."
HEALTH=$(docker exec $REDIS_CONTAINER redis-cli -a $UPSTASH_REDIS_REST_TOKEN ping)
if [ "$HEALTH" != "PONG" ]; then
	echo "❌ $REDIS_CONTAINER failed healthcheck."
	exit 1
fi

echo "✅ All Docker services are running and healthy!"
