const { 
    MJSHelpers: { isMJS, resolveImport }, 
    CJSHelpers: { toCJS, getImported }
} = require('builder');
const path = require('path');
const fs = require('fs');

module.exports = async function(util) {
    util.file = toCJS(util.file);
    const imports = getImported(util.file);
    for (const [start, end, imported] of imports) {
        const [_, imp, res] = await resolveImport(path.dirname(util.path), imported, util.manager);
        if (!fs.existsSync(res)) continue;
        util.replace(start, end, JSON.stringify(imp));
    }
}
module.exports.matchFile = util => util.matchType('js,mjs,cjs');