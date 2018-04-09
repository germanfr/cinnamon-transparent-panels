#!/bin/bash

# ======================================
#  Auto xlet discovery
# ======================================

json_prop () {
    python3 -c "import sys, json; print(json.load(sys.stdin)['$1']);"
}

metadata=$(find . -name metadata.json -print -quit)
UUID=$(cat "$metadata" | json_prop 'uuid')

if [ -e "$UUID/extension.js" ]; then xlet_type='extension'
elif [ -e "$UUID/applet.js" ]; then xlet_type='applet'
elif [ -e "$UUID/desklet.js" ]; then xlet_type='desklet'
else echo "Missing xlet Javascript files" && exit 1
fi

# ======================================
#  Constants
# ======================================

install_dir="$HOME/.local/share/${xlet_type}s"

assets_dir='icons'

zip_name="$UUID.zip"

# Relative to the project's root
package_files=(
    "$UUID/${xlet_type}.js"
    $(find $UUID -name *.js)
    "$UUID/metadata.json"
    "$UUID/settings-schema.json"
    "$UUID/po/"
    "$UUID/icons/"
    "$UUID/icon.png"
    "$UUID/stylesheet.css"
)

# Files that need to be moved into the $uuid folder
extra_files=(
    'LICENSE'
    'README.md'
    'screenshot.png'
)

# ======================================
#  Operations
# ======================================

symlink_xlet () {
    mkdir -p "$install_dir"
    rm -rf "$install_dir/$UUID"
    ln -rfs "$UUID" "$install_dir/"
}

install_theme () {
    if [ "$2" == "dev" ]; then
        symlink_xlet
    else
        spices_package &> /dev/null
        mkdir -p "$install_dir"
        rm -rf "$install_dir/$UUID"
        unzip $zip_name -d "$install_dir"
        rm $zip_name
    fi

    cd "$UUID"
    cinnamon-json-makepot -i

    echo "Xlet installed into $install_dir"
}

spices_package () {
    rm -f "$zip_name"
    zip -r --symlinks "$zip_name" "${package_files[@]}"

    for ef in ${extra_files[@]} ;do
        local filename=`basename $ef`
        ln -rfs "$ef" "$UUID/$filename"
        zip -r "$zip_name" "$UUID/$filename"
        rm -rf "$UUID/$filename"
    done

    echo "Files compressed into $zip_name"
}

simplify_assets () {
    simplify () {
        scour -i "$1" -o "$2"\
            --remove-metadata \
            --enable-id-stripping \
            --protect-ids-noninkscape \
            --disable-simplify-colors
    }

    # Usage: print_progress PROGRESS TOTAL
    print_progress () {
        local n_cols=$(($(tput cols)-7))
        local cols_completed=$(($1*n_cols/$2))
        local percent_completed=$(($1*100/$2))

        echo -n "$percent_completed% "
        for ((i=0; i<$cols_completed; i++)) {
            echo -n '#'
        }
    }

    cd "$UUID/"

    if type scour &> /dev/null ; then

        # temp dir for the output (can't output to self)
        local tmp_dir=$(mktemp -d)
        local assets_list=$(find $assets_dir/ -name '*.svg')
        local n_assets=$(echo "$assets_list" | wc -l)
        local completed=0

        for res in $assets_list ; do
            echo -e "> Simplifying \e[34m$(basename $res)\e[0m"
            print_progress $completed $n_assets

            output=$(simplify "$res" "$tmp_dir/out.svg")
            mv "$tmp_dir/out.svg" "$res"

            echo -en '\033[2K\r' # clear old progress bar
            echo "  $output"
            ((completed=completed+1))
        done

        echo 'Simplify assets task finished'
    else
        echo 'scour not found'
    fi
}

submit_to_spices () {
    local url=$(cat "$metadata" | json_prop 'url')
    local name=$(cat "$metadata" | json_prop 'name')
    local version=$(cat "$metadata" | json_prop 'version')
    spices_package &> /dev/null
    mv "$zip_name" "../spices-${xlet_type}s/$UUID/"
    cd "../spices-${xlet_type}s/$UUID/"

    git checkout master
    git pull linuxmint master
    git branch -D "$UUID"
    git checkout -b "$UUID"

    rm -rf files/*
    unzip "$zip_name" -d files/ > /dev/null
    rm "$zip_name"

    git add files/
    git status
    git commit -m "Update $name v$version ($UUID)

Changelog at: $url/commits/master"
}


show_help () {
    local bold=$(tput bold)
    local normal=$(tput sgr0)

    echo "\
${bold}USAGE${normal}
    ./$(basename $0) --OPTION

${bold}OPTIONS${normal}
  --install [dev]   Install the theme into the system.
                    Add 'dev' to just create a symbolic link to here.

${bold}DEVELOPMENT OPTIONS${normal}

  --pkg             Package files ready to be uploaded to the Cinnamon Spices.

  --simplify        Optimize SVG assets for a smaller size and a better theme
                    performance stripping metadata and other stuff.

  --help            Show help.
"
}

# ======================================
#  Start point
# ======================================

declare -A operations
operations[install]=install_theme
operations[help]=show_help
operations[pkg]=spices_package
operations[simplify]=simplify_assets
operations[submit]=submit_to_spices # Obscure

if [[ $1 == --?* ]]
then
    opname=${1:2}
    opfunc="${operations[$opname]}"

    if [[ -n "$opfunc" ]]
    then $opfunc "$@"
    else
        echo "$opname: command not found"
        show_help
    fi
else
    show_help
fi
