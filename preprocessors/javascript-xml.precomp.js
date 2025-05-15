/** @import { PrecompToken } from '../builder/precomp-utils' */

function isUppercase(tag) {
    return 'QWERTYUIOPASDFGHJKLZXCVBNM'.includes(tag[0]);
}
function fixCustom(tag) {
    const split = [...tag]
        .reduce((cur, val) => {
            if (isUppercase(val)) 
                cur.push([val.toLowerCase()]);
            else 
                cur.at(-1).push(val);

            return cur;
        }, []);
    if (split.length < 2) 
        throw new SyntaxError('ALL custom elements MUST be able to consist of atleast two strings seperated by a dash')
    return split.map(list => list.join('')).join('-');
}
/**
 * @typedef {Object} JSXStartToken
 * @extends {PrecompToken}
 * @property {string} tagname
 * 
 * @typedef {Object} JSXAttributeToken
 * @extends {PrecompToken}
 * @property {string} key
 * @property {string?} value
 * 
 * @typedef {Object} JSXAttributeCloseToken
 * @extends {PrecompToken}
 * 
 * @typedef {Object} JSXEndToken
 * @extends {PrecompToken}
 * @property {string?} tagname
 * 
 * @typedef {[JSXStartToken, ...JSXAttributeToken, JSXAttributeCloseToken, JSXElementToken[], JSXEndToken]} JSXElementToken
 * @param {JSXElementToken[]} tokens 
 */
function parseTokens(tokens, util) {
    const output = [];
    for (const batch of tokens) {
        const end = batch.at(-1);
        const isShorthand = end.name === 'close' || !end.tagname
        const start = batch[0];
        if (end.tagname && end.tagname !== start.tagname && end.namespace !== start.namespace)
            throw new SyntaxError(`XML End must equal XML Start (${start.namespace}:${start.tagname} !== ${end.namespace}:${end.tagname})`);
        const attributes = isShorthand 
            ? batch.slice(1, -2)
            : batch.slice(1, -3);
        const children = [''];
        if (!isShorthand) { 
            const elements = parseTokens(batch.at(-2), util);
            const mid = batch.find(tok => tok.name === 'close');
            let inside = 0;
            if (mid)
            for (let i = mid.end; i < end.start; i++) {
                const el = elements.find(tok => i >= tok.start && i < tok.end);
                if (el) {
                    if (inside && !Array.isArray(children.at(-1)))
                        inside = 0;
                    if (inside) children.at(-1).push(el, '');
                    else children.push(el, '')
                    i = el.end -1;
                    continue;
                }
                if (util.file[i] === '{') {
                    if (inside <= 0) children.push(['']);
                    inside++;
                    if (inside <= 1) continue;
                }
                if (util.file[i] === '}') {
                    inside--;
                    if (inside <= 0) children.push('');
                    if (inside <= 0) continue;
                }
                if (inside > 0) {
                    const jmp = util.jumpArbit(util.file.slice(i));
                    const js = children.at(-1);
                    if (jmp) {
                        js[js.length -1] += util.file.slice(i, jmp +i);
                        i += jmp -1;
                        continue;
                    }
                    js[js.length -1] += util.file[i];
                    continue;
                }
                if (!/^\s/.test(util.file[i])) 
                    children[children.length -1] += util.file[i];
            }
        }

        const isCustom = isUppercase(start.tagname[0]);
        output.push({
            tagname: start.tagname,
            namespace: start.namespace,
            isCustom,
            isEmpty: attributes.length <= 0 && children.filter(Boolean).length <= 0,
            attributes: attributes.map(({ key, value, namespace }) => [key, value, namespace]),
            children: children.filter(Boolean),
            start: start.start,
            end: end.end
        });
    }
    return output;
}

let elVar = 0;
function makeJS(token, container, parent) {
    const elDef = token.isCustom 
        ? `new ${token.tagname}` 
        : `document.createElement("${token.tagname}")`;
    const containerExists = !!container;
    if (token.isEmpty && !containerExists) return parent 
        ? `${parent}.appendChild(${elDef}); `
        : elDef;
    if (!containerExists) container = `EL${elVar++}`;
    let res = `${!containerExists ? 'const ' : ''}${container} = ${elDef}; `;
    if (token.isEmpty && containerExists) return res;

    for (const [key, value, namespace] of token.attributes) {
        switch (namespace) {
        case 'on':
            res += `${container}.addEventListener("${key}", ${value.slice(1, -1)}); `;
            break;
        default:
            res += `setAttribute(${container}, "${key}", ${value 
                ? value[0] === '{' 
                    ? value.slice(1, -1) 
                    : '`' + value.slice(1, -1).replaceAll('`', '\\`') + '`'
                : 'true'}); `;
        }
    }
    for (const child of token.children) {
        if (typeof child === 'string') {
            res += `${container}.appendChild(document.createTextNode(${JSON.stringify(child)})); `;
            continue;
        }
        if (Array.isArray(child)) {
            res += `appendChildren(${container}, [`;
            for (const part of child) {
                if (typeof part === 'string') {
                    res += part;
                    continue;
                }
                res += makeJS(part);
            }
            res += ']); '
            continue;
        }
        res += makeJS(child, null, container);
    }
    res += parent 
        ? `${parent}.appendChild(${container}); ` 
        : '';

    const isAsync = res.includes('await');
    return parent || containerExists
        ? res
        : `(${isAsync ? 'await ' : ''}(${isAsync ? 'async ' : ''}() => {${res} return ${container};})())`;
}

module.exports = async function(util) {
    util.tokenize({
        end: /^(\/>|<\/(?:(?<namespace>[a-z$_][a-z$_0-9-]*):)?(?<tagname>[a-z$_][a-z$_0-9-]*\s*)>)/i,
        _(str) {
            const jmp = util.jumpArbit(str);
            return jmp ? { length: jmp } : null;
        },
        start: /^<(?:(?<namespace>[a-z$_][a-z$_0-9-]*):)?(?<tagname>[a-z$_][a-z$_0-9-]*)\s*/i,
        attributes(str) {
            const name = str.match(/^(?:([a-z$_][a-z$_0-9-]*):)?([a-z$_][a-z$_0-9\-]*)\s*/i);
            if (!name) return;
            const split = name[0].length;
            if (str[split] !== '=') return { key: name[2], namespace: name[1], length: name[2].length };
            const val = str.slice(split +1).trimStart();
            if (val[0] === '"' || val[0] === "'") {
                const value = str.slice(split +1).match(/\s*('([^']|\\')*'|"([^"]|\\")*")/i);
                return {
                    key: name[2],
                    namespace: name[1],
                    value: value[1],
                    length: split + value[0].length +1
                }
            }
            if (val[0] !== '{') return;
            let indent = 0;
            for (let i = 0; i < val.length; i++) {
                const jmp = util.jumpArbit(val.slice(i));
                if (jmp) {
                    i += jmp -1;
                    continue;
                }
                if (val[i] === '{') indent++;
                if (val[i] === '}') indent--;
                if (indent <= 0)
                    return {
                        key: name[2],
                        namespace: name[1],
                        value: val.slice(0, i +1),
                        length: i + split + (str.slice(split -1).length - val.length)
                    }
            }
        },
        close: /^>/
    }, ['start', '*attributes', '?close', '^', 'end']);
    
    for (const usage of parseTokens(util.tokens, util)) {
        const elStr = util.file.slice(0, usage.start);
        const contMatch = elStr.match(/(?<variable>[_$a-z][_$a-z0-9.]*)\s*=\s*$/i);
        const container = contMatch?.groups?.variable;
        const start = contMatch?.index ?? usage.start;
        if (usage.tagname === 'define') {
            let gen = `${container} = defineElement("${fixCustom(container)}", {`;
            for (const [key, value, namespace] of usage.attributes) {
                gen += `["${namespace ? `${namespace}:` : ''}${key}"]: ${value 
                    ? value[0] === '{' 
                        ? value.slice(1, -1) 
                        : '`' + value.slice(1, -1).replaceAll('`', '\\`') + '`' 
                    : 'true'},`;
            }
            gen += `}, async function(shadow) {${makeJS({
                tagname: 'div',
                isCustom: false,
                isEmpty: !usage.children.length,
                attributes: [],
                children: [...usage.children]
            }, null, 'shadow')}});`;
            util.replace(start, usage.end, gen);
            continue;
        }
        util.replace(start, usage.end, makeJS(usage, container));
    }
    util.path = util.path.replace(/jsx$/i, 'js');
}
module.exports.matchFile = util => util.matchType('.jsx');