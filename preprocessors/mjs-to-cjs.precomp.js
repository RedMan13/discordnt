const { 
    MJSHelpers: { isMJS, resolveImport }, 
    CJSHelpers: { toCJS, getMJSImported }
} = require('builder');
const path = require('path');

module.exports = async function(util) {
    const imports = getMJSImported(util.file);
    util.file = toCJS(util.file);
    for (const imported of imports) {
        const real = await resolveImport(path.dirname(util.path), imported);
        let rel = util.manager.built[real[2]] ?? real[1];
        if (!path.extname(rel).endsWith('js') && !util.manager.built[real[2]])
            rel = await resolveImport(path.dirname(util.path), imported, util);
        util.file.replaceAll(imported, rel);
    }
}
module.exports.matchFile = util => (util.matchType('js,mjs,cjs') && isMJS(util.file));