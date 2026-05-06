#!/usr/bin/env bash

set -o errexit

export CARGO_HOME="$PWD/.render-cargo"
mkdir -p "$CARGO_HOME"

cd web
npm ci
npm run build

cd ../api
rm -rf priv/static/assets priv/static/cesium priv/static/textures priv/static/index.html priv/static/favicon.svg priv/static/icons.svg
cp -R ../web/dist/. priv/static/

mix deps.get --only prod
MIX_ENV=prod mix compile
MIX_ENV=prod mix phx.digest
MIX_ENV=prod mix phx.gen.release
MIX_ENV=prod mix release --overwrite
