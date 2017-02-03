#!/bin/bash

UUID="transparent-panels@germanfr"
ZIP_NAME="${UUID}.zip"

# Don't add folders here
EXTRAS="LICENSE README.md screenshot.png"

rm -f $ZIP_NAME

ln $EXTRAS $UUID/
zip -r --symlinks $ZIP_NAME $UUID

cd $UUID
rm $EXTRAS
