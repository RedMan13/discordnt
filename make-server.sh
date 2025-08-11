# file isnt copied naturaly, sadly
cp ./server/default-config.yml ./dist/server/default-config.yml
# node modules is never built, and therefore incomplete
for filename in ./dist/node_modules/*; do
    cp -rn "./node_modules/$(basename "$filename")" "./dist/node_modules"
    # builder built these all to cjs, dont let node act like its still mjs
    sed -i 's/"type": "module"/"type": "commonjs"/g' "./dist/node_modules/$(basename "$filename")/package.json"
done
pkg -C GZip -c ./package.json ./dist/server/index.js
mkdir ./dist/linux
mkdir ./dist/mac
mkdir ./dist/windows
mv ./index-linux ./dist/linux/server
mv ./index-macos ./dist/mac/server
mv ./index-win.exe ./dist/windows/server.exe
cp ./server/default.png ./dist/linux/default.png
cp ./server/default.png ./dist/mac/default.png
cp ./server/default.png ./dist/windows/default.png
cp ./server/default-config.yml ./dist/linux/config.yml
cp ./server/default-config.yml ./dist/mac/config.yml
cp ./server/default-config.yml ./dist/windows/config.yml
cp ./README.md ./dist/linux/README
cp ./README.md ./dist/mac/README
cp ./README.md ./dist/windows/README
# we need real copies to exist
mkdir ./dist/linux/node_modules
mkdir ./dist/mac/node_modules
mkdir ./dist/windows/node_modules
for filename in ./dist/node_modules/*; do
    cp -r "$filename" "./dist/linux/node_modules"
    cp -r "$filename" "./dist/mac/node_modules"
    cp -r "$filename" "./dist/windows/node_modules"
done
cd ./dist/linux
zip -r ./linux.zip .
mv ./linux.zip ../linux.zip
cd ../mac
zip -r ./mac.zip .
mv ./mac.zip ../mac.zip
cd ../windows
zip -r ./windows.zip .
mv ./windows.zip ../windows.zip
cd ../../
rm -rf ./dist/linux
rm -rf ./dist/mac
rm -rf ./dist/windows
