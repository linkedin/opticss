#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m' # No Color
cd packages
if [ -d css-property-parser ]
then
  echo -e "${GREEN}✔ You already have css-property-parser checked out${NC}"
else
  git clone git@github.com:css-blocks/css-property-parser.git
  cd css-property-parser
  npm install
  npm run start
  cd ..
fi
cd ..

# These two packages no longer need to be linked. Remove after everyone has run this update.
yarn unlink postcss-selector-parser
for PACKAGE in resolve-cascade util template-api simple-template opticss demo-app
do
  cd packages/$PACKAGE
  yarn unlink postcss
  cd -
done

yarn install
yarn run bootstrap
yarn link css-select
yarn link css-size

for PACKAGE in resolve-cascade util template-api simple-template opticss demo-app
do
  cd packages/$PACKAGE
  echo -e "${GREEN}✔ Running $PACKAGE tests${NC}"
  yarn test || (echo "ERROR in $PACKAGE" && exit 1) || exit 1
  cd -
done
