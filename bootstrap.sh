#!/bin/bash

yarn install
yarn run bootstrap
yarn link css-select
yarn link postcss

cd packages
if [ -d css-property-parser ]
then
  cd -
  cd packages/css-property-parser
  git pull
else
  git checkout https://github.com/css-blocks/css-property-parser.git
fi
cd -

for PACKAGE in resolve-cascade util template-api simple-template opticss demo-cli
do
  cd packages/$PACKAGE
  yarn link postcss
  yarn test || (echo "ERROR in $PACKAGE" && exit 1) || exit 1
  cd -
done