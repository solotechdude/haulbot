#!/usr/bin/env bash
# One-time dev migration: relaybooking_solo → haulbot (same MongoDB host).
# Requires relaybooking-solo-mongodb (or haulbot-mongodb) on port 27019.

set -euo pipefail

CONTAINER="${MONGO_CONTAINER:-relaybooking-solo-mongodb}"

echo "Migrating relaybooking_solo → haulbot via ${CONTAINER}…"
docker exec "${CONTAINER}" mongodump --db=relaybooking_solo --archive \
  | docker exec -i "${CONTAINER}" mongorestore --archive --drop \
      --nsFrom='relaybooking_solo.*' --nsTo='haulbot.*'

docker exec "${CONTAINER}" mongosh haulbot --quiet --eval \
  'db.getCollectionNames().filter(c=>!c.startsWith("system.")).forEach(c=>print(c+":", db[c].countDocuments({})))'

echo "Done. Set MONGODB_URI=mongodb://127.0.0.1:27019/haulbot and restart backend."
