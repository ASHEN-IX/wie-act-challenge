#!/bin/sh
set -eu
python -m services.runtime_storage
exec "$@"
