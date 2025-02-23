const path = require('path');
const fs = require('fs/promises');
const pbjs = require('protobufjs-cli/pbjs');

let tmpNum = 0;
module.exports = async function(util) {
    const tmpFile = path.resolve(path.dirname(util.path), 'tmp' + (++tmpNum));
    await fs.writeFile(tmpFile, util.file);
    pbjs.main(['-t', 'static-module', '-w', 'commonjs', tmpFile], (err, out) => {
        if (err) throw err;
        util.file = out;
        util.path = util.path.replace(/\.proto$/i, '.js');
        fs.rm(tmpFile);
    });
}
module.exports.matchFile = util => util.matchType('.proto');