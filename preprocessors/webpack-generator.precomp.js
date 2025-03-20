const { 
    MJSHelpers: { resolveImport }, 
    CJSHelpers: { getDeepFiles }
} = require('builder');
const path = require('path');

async function jsGen(locPath, imp, util) {
    const files = await getDeepFiles(locPath, util);
    if (!files) return util.skip = true;
    let jsGen = 'const webpackFiles = {';
    for (const [file, data] of files) {
        jsGen += JSON.stringify('./' + path.relative(util.buildDir, file));
        jsGen += '(module,exports,require) {';
        jsGen += file.endsWith('js') ? data : `module.exports = new Int8Array(${JSON.stringify([...Buffer.from(data)])})`;
        jsGen += '},';
    }
    jsGen += '};';
    jsGen += `
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    function toBase64(bytes) {
        let out = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const num = ((bytes[i] << 16) & 0xFF0000) + ((bytes[i + 1] << 8) & 0x00FF00) + (bytes[i + 2] & 0x0000FF);
            out += chars[(num >> 18) & 0x3F] +
                chars[(num >> 12) & 0x3F] +
                chars[(num >> 6) & 0x3F] +
                chars[num & 0x3F];
        }
        return out.replace(/A+$/, m => '='.repeat(m.length));
    }
    class ImportError extends Error {}
    const validExts = ['.js', '.mjs', '.cjs', '.json'];
    const ranFiles = {};
    const binTexDecoder = new TextDecoder();
    const domParser = new DOMParser();
    function genReq(root) {
        return function(file, props) {
            props ??= {}
            props.type ||= file.split('.').at(-1);
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
            if (path[0][0] !== '.') path.unshift('.');
            const allTried = [];
            file = path.join('/');
            let triedExt = 0;
            let triedNode = false;
            while (!(file in webpackFiles)) {
                allTried.push(file);
                if (path.at(-1) === 'index' && !validExts[triedExt] && triedNode) {
                    path = path.slice(2, -1);
                    file = path.join('/');
                    break;
                }
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
            if (!(file in webpackFiles) && !globalThis.require)
                throw new ImportError(\`Could not locate a module at ./\${file} from \${root}. tried \${JSON.stringify(allTried, null, 4)}\`);
            if (!(file in webpackFiles) && globalThis.require)
                return require(old, props);
            if (file in ranFiles)
                return ranFiles[file].exports;
            const module = { exports: {} };
            ranFiles[file] = module;
            webpackFiles[file](module, module.exports, genReq(file.split('/').slice(0, -1).join('/')));
            if (!props.type.endsWith('js')) {
                let mimeType;
                switch (props.type) {
                case 'json': mimeType ??= 'application/json';
                    return module.exports = JSON.parse(binTexDecoder.decode(module.exports));
                case 'css': mimeType ??= 'text/css';
                    const style = new CSSStyleSheet();
                    style.replaceSync(binTexDecoder.decode(module.exports));
                    return module.exports = style;
                case 'txt': mimeType ??= 'text/plain';
                    return module.exports = binTexDecoder.decode(module.exports);
                case 'html': mimeType ??= 'text/html';
                case 'xml': mimeType ??= 'text/xml';
                    return module.exports = domParser.parse(binTexDecoder.decode(module.exports));
                case 'webp': mimeType ??= 'image/webp';
                case 'svg': mimeType ??= 'image/svg+xml';
                case 'png': mimeType ??= 'image/png';
                case 'jpg':
                case 'jpeg': mimeType ??= 'image/jpeg';
                case 'gif': mimeType ??= 'image/gif';
                case 'avif': mimeType ??= 'image/avif';
                case 'apng': mimeType ??= 'image/apng';
                    const link = \`data:\${mimeType};base64,\${toBase64(module.exports)}\`;
                    const Element = defineElement(path.at(-1).split('.', 2)[0], {}, function(shadow) {
                        const img = new Image();
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.src = link;
                        shadow.appendChild(img);
                    });
                    module.exports = Element;
                    break;
                case 'proto': break;
                case 'jsx': break;
                default:
                    console.warn(\`Couldnt handle file type \${props.type} when importing file \${old}\`);
                    break;
                }
            }
            return module.exports;
        }
    }
    genReq('.')(${JSON.stringify(imp)});
    `;
    return jsGen;
}
module.exports = async function(util) {
    for (const m of util.file.matchAll(/<script.*?>/gi)) {
        const src = m[0].match(/src="(.*?)"/i);
        if (!src) continue;
        const [_, imp, locPath] = await resolveImport(path.dirname(util.path), src[1], util);
        const start = src.index + m.index;
        const end = start + src[0].length;
        util.replace(start, end, `>${await jsGen(locPath, imp, util)}</script`);
    }
}
module.exports.matchFile = util => util.matchType('html,php');