#!/bin/bash

GIST_URL='https://gist.githubusercontent.com/germanfr/6f48336523fa8a464362fb4249c63950/raw/utils.sh'

# ======================================
#  Auto xlet discovery
# ======================================

json_prop () {
    python3 -c "import sys, json; print(json.load(sys.stdin)['$1']);"
}

metadata=$(find . -name 'metadata.json' -print -quit)
get_xlet_meta () {
	json_prop $1 < $metadata
}

UUID=$(get_xlet_meta uuid)

if [ -e "$UUID/extension.js" ]; then xlet_type='extension'
elif [ -e "$UUID/applet.js" ]; then xlet_type='applet'
elif [ -e "$UUID/desklet.js" ]; then xlet_type='desklet'
else echo "Missing xlet Javascript files" && exit 1
fi

# ======================================
#  Constants
# ======================================

install_dir="$HOME/.local/share/cinnamon/${xlet_type}s"

zip_name="${UUID}.zip"

COMMON_FILES=(
    "$UUID/${xlet_type}.js"
    "$UUID/metadata.json"
    "$UUID/settings-schema.json"
    "$UUID/po/"
    "$UUID/icons/"
    "$UUID/icon.png"
    "$UUID/stylesheet.css"
)

# Load options (files that will be packaged)
. ./pkg-options

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
        unzip "$zip_name" -d "$install_dir"
        rm "$zip_name"
    fi

    cd "$UUID"
    cinnamon-json-makepot -i

    echo "${xlet_type^} installed into $install_dir"
}

spices_package () {
    rm -f "$zip_name"

    local all_files="${COMMON_FILES[@]} ${PACKAGE_FILES[@]/#/${UUID}\/}"
    zip -r --symlinks "$zip_name" $all_files

    for ef in "${EXTRA_FILES[@]}"; do
        local filename=$(basename "$ef")
        ln -rfs "$ef" "$UUID/$filename"
        zip -r "$zip_name" "$UUID/$filename"
        rm -rf "$UUID/$filename"
    done

    echo "Files compressed into $zip_name"
}

simplify_assets () {
	if [[ -z "$ASSETS_DIR" ]]; then
		echo "No assets folder in this $xlet_type"
		return
	fi

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
        local assets_list=$(find "$ASSETS_DIR/" -name '*.svg' -type f)
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
    local url=$(get_xlet_meta url)
    local name=$(get_xlet_meta name)
    local version=$(get_xlet_meta version)
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

    echo -n 'Push changes (git push)? [y/n] '
    read confirm
    if [[ $confirm =~ ^([yY]([eE][sS])?)?$ ]]
        then git push -fu origin $UUID
    fi
}

update_self () {
	wget -O $(basename $0) $GIST_URL
}


show_help () {
    local bold=$(tput bold)
    local normal=$(tput sgr0)
    local name=$(get_xlet_meta name)

    echo "\
${bold}${name^^} ${xlet_type^^} HELP${normal}
Usage: ./$(basename $0) [COMMAND]

${bold}COMMANDS${normal}
  install [dev]     Install the theme into the system.
                    Add 'dev' to just create a symbolic link to here.

  help              Show help.

${bold}DEVELOPMENT COMMANDS${normal}

  pkg               Package files ready to be uploaded to the Cinnamon Spices.

  simplify          Optimize SVG assets for a smaller size and a better theme
                    performance stripping metadata and other stuff.

  update            Fetch the latest version available of this script.
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
operations[update]=update_self

opname="$1"
opfunc="${operations[$opname]}"

if [[ -n "$opfunc" ]]
then $opfunc "$@"
else
    echo "$opname: command not found"
    show_help
fi
