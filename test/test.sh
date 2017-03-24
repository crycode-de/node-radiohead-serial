#!/bin/bash

MAIN_DIR=$(dirname $(dirname $(readlink -f ${0})))

cd $MAIN_DIR

which socat > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "The tool 'socat' is needed for testing but not found on this system."
  exit 1
fi

export PATH=$PATH:$MAIN_DIR/node_modules/mocha/bin:$MAIN_DIR/node_modules/istanbul/bin

istanbul cover _mocha test
