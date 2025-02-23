const { exec } = require('@yao-pkg/pkg');
const path = require('path');
const fs = require('fs');
const { 
    MJSHelpers: { resolveImport },
    CJSHelpers: { getDeepFiles, getImported }
} = require('builder');

module.exports = async function(util) {
    const imports = getImported(util.file);
    for (const imported of imports) {
        const [_, real, targ] = await resolveImport(path.dirname(util.path), imported, util);
        if (!fs.existsSync(targ)) continue;
        await getDeepFiles(targ, util);
        util.file = util.file.replaceAll(imported, real);
    }
    await util.bake(util.buildDir);
    // exec(['-C', 'GZip', util.path]);
}
module.exports.matchFile = util => (util.matchType('js,mjs,cjs') && util.file.startsWith('#!'));