#!/bin/bash

UUID="transparent-panels@germanfr"
ZIP_NAME="${UUID}.zip"

if [ -f $ZIP_NAME ] ;then
	rm $ZIP_NAME
fi

zip -r $ZIP_NAME $UUID README.md LICENSE screenshot.png
