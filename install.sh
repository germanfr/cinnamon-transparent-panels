#!/bin/bash

UUID="transparent-panels@germanfr"

cp -r $UUID/ ~/.local/share/cinnamon/extensions/
cd ~/.local/share/cinnamon/extensions/$UUID/
cinnamon-json-makepot -i
