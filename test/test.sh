#!/bin/bash
#
# Node.js RadioHead Serial
#
# Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de/)
#
# Node.js module for communication between some RadioHead nodes and Node.js using
# the RH_Serial driver and the RHReliableDatagram manager of the RadioHead library.
#
MAIN_DIR=$(dirname $(cd $(dirname "$0"); pwd -P))

cd $MAIN_DIR

which socat > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "The tool 'socat' is needed for testing but not found on this system."
  exit 1
fi

export PATH=$PATH:$MAIN_DIR/node_modules/.bin

istanbul cover _mocha --harmony dist/test
