pkg -C GZip -c ./package.json ./dist/server/index.js
mkdir ./dist/linux
mkdir ./dist/mac
mkdir ./dist/windows
mv ./index-linux ./dist/linux/server
mv ./index-macos ./dist/mac/server
mv ./index-win.exe ./dist/windows/server.exe
cp ./dist/server/default.png ./dist/linux/default.png
cp ./dist/server/default.png ./dist/mac/default.png
cp ./dist/server/default.png ./dist/windows/default.png
cp ./dist/server/default-config.yml ./dist/linux/config.yml
cp ./dist/server/default-config.yml ./dist/mac/config.yml
cp ./dist/server/default-config.yml ./dist/windows/config.yml
cp ./README.md ./dist/linux/README
cp ./README.md ./dist/mac/README
cp ./README.md ./dist/windows/README
cp -r ./dist/node_modules ./dist/linux/node_modules
cp -r ./dist/node_modules ./dist/mac/node_modules
cp -r ./dist/node_modules ./dist/windows/node_modules
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
