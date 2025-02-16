const { 
    MJSHelpers: { isMJS, resolveImport }, 
    CJSHelpers: { toCJS, getCJSRequired }
} = require('builder');
const mime = require('mime');
const path = require('path');

const handled = {};
async function getDeepFiles(file, manager, props) {
    if (handled[file]) return;
    handled[file] = true;
    
    let data = (await manager.getFile(file))[1];
    let out = [[file, data]];
    switch (props.type.toLowerCase()) {
    case 'apng':
    case 'avif':
    case 'gif':
    case 'jpeg':
    case 'png':
    case 'svg':
    case 'webp':
        data = `module.exports = defineElement(${JSON.stringify(path.parse(file).name.replace(/[^a-z]+/ig, '-'))}, {}, shad => {const img = new Image(); img.style.width = '100%'; img.style.height = '100%'; img.src = "data:${mime.lookup(props.type)};base64,${JSON.stringify(Buffer.from(data).toString('base64')).slice(1, -1)}"; shad.appendChild(img);});`;
        break;
    case 'html':
        data = `module.exports = parseHTMLUnsafe(${JSON.stringify(data)});`;
        break;
    case 'xml':
        data = `const parser = new DOMParser(); module.exports = parser.parseFromString(${JSON.stringify(data)}, "text/xml");`;
        break;
    case 'txt':
        data = `module.exports = ${JSON.stringify(data)};`;
        break;
    case 'css':
        data = `module.exports = new CSSStyleSheet(); module.exports.replaceSync(${JSON.stringify(data)});`;
        break;
    case 'json':
        data = `module.exports = JSON.parse(${JSON.stringify(data)});`;
        break;
    default:
    case 'js':
    case 'mjs':
    case 'cjs': {
        let imports;
        if (isMJS(data))
            [imports, data] = toCJS(data);
        else
            imports = getCJSRequired(data);
        for (const [imported, props] of imports) {
            const real = (await resolveImport(path.dirname(file), imported, manager))[2];
            props.type ||= path.extname(real).slice(1) || 'js';
            const datas = await getDeepFiles(real, manager, props);
            if (!datas) continue;
            out = out.concat(datas);
        }
        break;
    }
    }
    out[0][1] = data;
    return out;
}
module.exports = async function(util) {
    for (const m of util.file.matchAll(/<script.*?>/gi)) {
        const src = m[0].match(/src="(.*?)"/i);
        if (!src) continue;
        const locPath = (await resolveImport(path.dirname(util.path), src[1], util))[2];
        const files = await getDeepFiles(locPath, util, { type: 'js' });
        if (!files) return util.skip = true;
        let jsGen = 'const webpackFiles = {';
        for (const [file, data] of files) {
            jsGen += JSON.stringify('./' + path.relative(util.entry, file));
            jsGen += '(module,exports,require) {';
            jsGen += data;
            jsGen += '},';
        }
        jsGen += '};';
        jsGen += `
        class ImportError extends Error {}
        const validExts = ['.js', '.mjs', '.cjs', '.json'];
        const ranFiles = {};
        function genReq(root) {
            return function require(file) {
                const old = file;
                let path = root.split('/');
                const instructs = file.split('/');
                for (const inst of instructs) {
                    switch (inst) {
                    case '.': break;
                    case '..': 
                        if (path.at(-1) === '..' || path.length <= 0)
                            path.push('..');
                        else 
                            path.pop(); 
                        break;
                    default: path.push(inst); break;
                    }
                }
                const allTried = [];
                file = path.join('/');
                let triedExt = 0;
                let triedNode = false;
                while (!(file in webpackFiles)) {
                    allTried.push(file);
                    if (path.at(-1) === 'index' && !validExts[triedExt] && triedNode)
                        throw new ImportError(\`Could not locate a module at ./\${path.slice(2, -1).join('/')} from \${root}. tried \${JSON.stringify(allTried, null, 4)}\`);
                    if (path.at(-1) === 'index' && !validExts[triedExt] && !triedNode) {
                        path = old.split('/');
                        path.unshift('.', 'node_modules');
                        triedExt = 0;
                        triedNode = true;
                    }
                    if (!validExts[triedExt]) { path.push('index'); triedExt = 0; }
                    file = path.join('/');
                    file += validExts[triedExt++];
                }
                if (file in ranFiles)
                    return ranFiles[file].exports;
                const module = { exports: {} };
                ranFiles[file] = module;
                webpackFiles[file](module, module.exports, genReq(file.split('/').slice(0, -1).join('/')));
                return module.exports;
            }
        }
        genReq('.')(${JSON.stringify(path.relative(util.entry, locPath))});
        `;
        util.replace(src.index + m.index, src.index + m.index + src[0].length, `>${jsGen}</script`);
        for (const key in handled)
            delete handled[key];
    }
}
module.exports.matchFile = util => util.matchType('html,php');