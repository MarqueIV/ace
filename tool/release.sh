#!/bin/bash
set -e

pause() {
    while true; do
        read -p "$1 " yn
        case $yn in
            [Yy]* ) break;;
            [Nn]* ) exit;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}



cd `dirname $0`/..
SOURCE=`pwd`

# check if build dir is clean
if ! [ -f build/.git/HEAD ]; then
    git clone git@github.com:ajaxorg/ace-builds.git build
fi
pushd build
git fetch
if [ "$(git rev-parse --revs-only HEAD)" != "$(git rev-parse --revs-only refs/remotes/origin/master)" ]; then 
    echo build directory not clean; 
    exit 1
fi
if [ "$(git ls-files --others --exclude-standard)" ];  then
    echo untracked files;
    git ls-files --others --exclude-standard
    exit 1
fi
popd

# clean untracked files from modes and themes
while read line; do
    if [ -f "$line" ]; then
        mkdir -p "_$(dirname "$line")"; 
        echo "$line"; 
        mv "$line" "_$line";
    fi
done <<< "$(git ls-files --others --exclude-standard lib/ace)"


# show history
git checkout refs/remotes/origin/master -- package.json
CUR_VERSION=`node -e 'console.log(require("./package.json").version)'`
git --no-pager log --color --first-parent --oneline v$CUR_VERSION..master | 
    sed -e s"/^/https:\/\/github.com\/ajaxorg\/ace\/commit\//"
echo "current version is $CUR_VERSION"

# get new version number
git checkout -- package.json
git checkout -- CHANGELOG.md
npm run changelog
VERSION_NUM="$(node -p "require('./package.json').version")";
echo "recommended version number for the build is" $VERSION_NUM 

read -p "do you want to continue with the recommended version number? [y/n] " yn

if [[ $yn == "n" ]]; then 
    read -p "what should the new version be? (Example: 1.2.3) " VERSION_NUM 
fi

# update version number everywhere
node -e "
    var fs = require('fs');
    var version = '$VERSION_NUM';
    function replaceVersion(str) {
        return str.replace(/(['\"]?version['\"]?\s*[:=]\s*['\"])[\\d.\\w\\-]+(['\"])/, function(_, m1, m2) {
            return m1 + version + m2;
        });
    }
    function update(path, replace) {
        var pkg = fs.readFileSync(path, 'utf8');
        pkg = (replace || replaceVersion)(pkg);
        fs.writeFileSync(path, pkg, 'utf8');
    }
    update('package.json');
    update('build/package.json');
    update('./src/config.js');
    update('ace.d.ts');
    update('./types/ace-modules.d.ts');
"

pause "versions updated to $VERSION_NUM. do you want to start build script? [y/n]"

node Makefile.dryice.js full
cd build
git add .
git commit --all -m "package `date +%d.%m.%y`"


echo "build task completed."
pause "continue creating the tag for v$VERSION_NUM [y/n]"
if [[ ${VERSION_NUM} != *"-"* ]]; then
    git tag "v"$VERSION_NUM
fi

pause "continue pushing to github? [y/n]"

git push --progress "origin" HEAD:gh-pages HEAD:master refs/tags/"v"$VERSION_NUM:refs/tags/"v"$VERSION_NUM

echo "build repository updated"

pause "continue update ace repo? [y/n]"
cd ..

git commit -a -m "release v$VERSION_NUM"

echo "new commit added"
pause "continue creating the tag for v$VERSION_NUM [y/n]"
if [[ ${VERSION_NUM} != *"-"* ]]; then
    git tag "v"$VERSION_NUM
fi

pause "continue pushing to github? [y/n]"

git push --progress "origin" HEAD:master refs/tags/"v"$VERSION_NUM:refs/tags/"v"$VERSION_NUM


pause "update api docs [y/n]"
bash tool/release-api-docs.sh

echo "All done!"
pause "May I go now? [y/n]"

