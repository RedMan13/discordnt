pkg -C GZip ./dist/index.js
mkdir ./dist/linux
mkdir ./dist/mac
mkdir ./dist/windows
mv ./index-linux ./dist/linux/server
mv ./index-macos ./dist/mac/server
mv ./index-win.exe ./dist/windows/server.exe
cp ./dist/default.png ./dist/linux/default.png
cp ./dist/default.png ./dist/mac/default.png
cp ./dist/default.png ./dist/windows/default.png
cp ./README.md ./dist/linux/README
cp ./README.md ./dist/mac/README
cp ./README.md ./dist/windows/README
zip -r ./dist/linux.zip ./dist/linux
zip -r ./dist/mac.zip ./dist/mac
zip -r ./dist/windows.zip ./dist/windows
rm -rf ./dist/linux
rm -rf ./dist/mac
rm -rf ./dist/windows
rm -f ./dist/default.png
rm -f ./dist/README.md