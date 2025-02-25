const { 
    MJSHelpers: { isMJS }, 
    CJSHelpers: { toCJS, getDeepFiles }
} = require('builder');
const path = require('path');

module.exports = async function(util) {
    util.file = toCJS(util.file);
    const [[file, data]] = await getDeepFiles(util.path, util);
    util.file = data;
}
module.exports.matchFile = util => (util.matchType('js,mjs,cjs') && isMJS(util.file));