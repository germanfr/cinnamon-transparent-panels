#!/bin/bash

UUID="transparent-panels@germanfr"
ZIP_NAME="${UUID}.zip"

# Don't add final slash to folders
EXTRAS="LICENSE README.md screenshot.png"

if [ -f $ZIP_NAME ] ;then
	rm $ZIP_NAME
fi

ln -rfs $EXTRAS $UUID/
zip -r $ZIP_NAME $UUID

cd $UUID
rm $EXTRAS

