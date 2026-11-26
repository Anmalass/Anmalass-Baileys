#!/bin/sh
../node_modules/.bin/pbjs -t static-module --no-beautify -w es6 --no-bundle --no-delimited --no-verify --no-comments -o ./index.js ./WAProto.proto
../node_modules/.bin/pbjs -t static-module --no-beautify -w es6 --no-bundle --no-delimited --no-verify ./WAProto.proto | ../node_modules/.bin/pbts --no-comments -o ./index.d.ts -
node ./fix-imports.js
