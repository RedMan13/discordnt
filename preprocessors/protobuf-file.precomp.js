const path = require('path');
const fs = require('fs/promises');
const pbjs = require('protobufjs-cli/pbjs');
const { PrecompUtils } = require('builder');

let tmpNum = 0;
module.exports = function(util) {
    if (typeof util === 'string') util = new PrecompUtils(path.resolve(this.context, './file.proto'), util);
    return new Promise(async resolve => {
        const tmpFile = path.resolve(path.dirname(util.path), `tmp${++tmpNum}.protobuf.js`);
        await fs.writeFile(tmpFile, util.file);
        pbjs.main(['-t', 'static-module', '-w', 'commonjs', tmpFile], (err, out) => {
            if (err) throw err;
            util.file = out;
            util.path = util.path.replace(/\.proto$/i, '.js');
            // most of the file size is just jsdoc comments, but the only ones seeing this file are debuggers so we dont need them
            util.file = util.file.replace(/\/\/[^\n]*|\/\*.*?\*\//gis, '');
            // now since we will still need to look at that code eventually, remove any empty lines we may have produced
            util.file = util.file.replace(/^(\s*\n){2,}/gm, '');
            fs.rm(tmpFile);
            resolve(util.file);
        });
    });
}
module.exports.matchFile = util => util.matchType('.proto');