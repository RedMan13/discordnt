import { Asset } from "../../api/asset-helper.js";
import { TimeStamp } from './timestamp.jsx';
import { TextSpoiler } from './spoiler.jsx';
import { UserAvatar } from '../profile.jsx';
import { Username } from '../username.jsx';
import { toUrl, Names } from '../../emojis.js';

export const syntax = [
    [/^(#{1,3})\s+(.+?)$/mi, [false, true], (level, content) => {
        switch (level) {
        default:
        case '#':
            return <h1>{content}</h1>
        case '##':
            return <h2>{content}</h2>
        case '###':
            return <h3>{content}</h3>
        }
    }],
    [/^-#\s+(.+?)$/mi, [true], content => <h6>{content}</h6>],
    [/^>\s*(.+?)$/mi, [true], content => <blockquote>{content}</blockquote>],
    [/^>>>\s*(.+?)\n\n*/mi, [true], content => <blockquote>{content}</blockquote>],
    [/^(?: *(?:[0-9]+\.|-|\*)\s+.+?\n)+/mi, async body => {
        const unWrap = body.matchAll(/^( *)([0-9\-\*\.]+)\s+(.+?)$/gmi);
        const nesting = [];
        const layers = [];
        let top = nesting;
        let level = -1;
        for (const m of unWrap) {
            const l = m[1].length / 2;
            if (level === -1) level = l;
            if (l > level) {
                const level = []
                top.push(level);
                top = level;
                layers.push(level);
            }
            if (l < level) {
                layers.pop();
                top = layers.at(-1);
            };
            top.push([/[0-9]/.test(m[2]), await format(m[3], false)]);
        }

        function resolveDeep(layer) {
            const inner = layer
                .map(item => (Array.isArray(item) 
                    ? resolveDeep(item) 
                    : <li>{item}</li>));
            return layer[0][0] 
                ? <ol>{inner}</ol> 
                : <ul>{inner}</ul>;
        }
        return resolveDeep(nesting);
    }],
    [/^\*\*\*(.+?)\*\*\*/i, [true], content => <strong><em>{content}</em></strong>],
    [/^\*\*(.+?)\*\*/i, [true], content => <strong>{content}</strong>],
    [/^\*(.+?)\*/i, [true], content => <em>{content}</em>],
    [/^```(?:([a-z]+)\n)?(.+?)```/is, [false, false], (lang, code) => <div class="external-code">{highlighter(lang, code)}</div>],
    [/^``?(.+?)``?/i, [true], content => <code>{content}</code>],
    [/^~~(.+?)~~/i, [true], content => <s>{content}</s>],
    [/^__(.+?)__/i, [true], content => <u>{content}</u>],
    [/^\|\|(.+?)\|\|/i, [true], content => <TextSpoiler>{content}</TextSpoiler>],
    [/^<@!?([0-9]+)>/i, [false], async id => <span class="mention">
        <UserAvatar style="height: 1lh; width: 1lh; display: inline-block; vertical-align: bottom;" user={id}/>
        <Username user={id}/>
    </span>],
    [/^<@&([0-9]+)>/i, [false], async id => {
        const role = client.askFor('Roles.get', id);
        const color = `#${role.color.toString(16).padStart(6, '0')}`;
        return role
            ? <span class="mention" style={`
                color: ${color}; 
                background-color: ${color}4D;
            `}><em>@</em> {role.name}</span>
            : <span class="mention"><em>@</em> Invalid Role</span>;
    }],
    [/^<#([0-9]+)>/i, [false], async id => {
        const channel = client.askFor('Channels.get', id);
        return channel 
            ? <span class="mention"><em>#</em> {channel.name}</span>
            : <span class="mention"><em>#</em> Invalid Channel</span>;
    }],
    [/^<id:([a-z]+)>/i, [false], content => <span class="mention"><em>#</em> {content}</span>],
    [/^<(a?):([a-z_0-9]+):([0-9]+)>/i, [false, false, false], async (animated, name, id) => {
        const image = Asset.CustomEmoji({ id }, animated ? 'gif' : 'png', 48);
        return <img title={name} class="emoji" src={image}/>;
    }],
    [/^:([a-z_0-9]+):/i, [false], name => Names[name] ? <img
        class="emoji"
        title={name}
        src={toUrl(Names[name])}
    /> : name],
    [/^(\p{Emoji})/i, [false], emoji => <img
        class="emoji"
        title={Names[emoji]}
        src={toUrl(emoji)}
    />],
    [/^\[(.+?)\]\(<?(https?:\/\/[^\s]*)>?\)/i, [true, false], (title, url) => <a href={`/redirect?target=${url}`}>{title}</a>],
    [/^<t:([0-9]+):([tTdDfFR])?>/i, [false, false], (time, style) => <TimeStamp t={time} s={style}></TimeStamp>],
    [/^<?(https?:\/\/[^\s]*)>?/i, [false], url => <a href={`/redirect?target=${url}`}>{url}</a>],
    [/^\n/i, () => <br/>],
]
/** @param {string} text */
export async function format(text, wrap = true) {
    const out = [''];
    for (let i = 0; i < text.length; i++) {
        const test = text.slice(i);
        const form = syntax.find(([reg]) => reg.multiline 
            ? text[i] === '\n' && reg.test(test.slice(1)) 
            : reg.test(test));
        if (!form) {
            out[out.length -1] += text[i];
            continue;
        }
        const match = form[0].multiline
            ? form[0].exec(test.slice('\n'))
            : form[0].exec(test);
        const el = match.length <= 1
            ? await form[1](match[0])
            : await form[2](
                ...(await Promise.all(match
                    .slice(1)
                    .map((m,i) => (form[1][i] ?? true)
                        ? format(m, false)
                        : m))),
                match.groups
            );
        if (out.at(-1) === '') out.pop();
        out.push(el, '');
        i += match[0].length -1;
        if (form[0].multiline) i++;
    }
    if (out.at(-1) === '') out.pop();
    return !wrap ? out : <div class="message-render">{out}</div>;
}
export { default as styles } from './md-styles.css';

// color table
// contains the full 256 ansi color mapping
const colors = [
    // normal
    // black      red        green      yellow     blue       purple     cyan       white
    "#000000", "#CD3131", "#0DBC79", "#E5E510", "#2472C8", "#BC3FBC", "#11A8CD", "#E5E5E5",
    // bright
    "#666666", "#F14C4C", "#23D18B", "#F5F543", "#3B8EEA", "#D670D6", "#29B8DB", "#E5E5E5",
    // 215 color space
    ...(new Array(215)
        .fill(0)
        .map((_, i) => i)
        .map(i => [i % 6, Math.floor(i / 6), Math.floor(i / 36)])
        .map(([r,g,b]) => [(r / 5 * 255), (g / 5 * 255), (b / 5 * 255)])
        .map(([r,g,b]) => [r.toString(16), g.toString(16), b.toString(16)])
        .map(([r,g,b]) => [r.padStart(2, '0'), g.padStart(2, '0'), b.padStart(2, '0')])
        .map(([r,g,b]) => `#${r}${g}${b}`)),
    // 22 gray-scale
    ...(new Array(22)
        .fill(0)
        .map((_, i) => `csv(0, 1, ${i / 22})`))
];

export const languages = {};
function ansi(str) {
    const term = [[]];
    let c0 = 1;
    let c1 = 1;
    const ex = () => {
        if (c1 > term.length)
            term.push(new Array(c0).fill(' '));
        if (c0 > term[c1 -1].length)
            term[c1 -1].push(' ');
    }
    const cs = (x=1,y=1) => {
        c0 = Math.max(x, 1);
        c1 = Math.max(y, 1);
        ex();
    }
    const cp = (x=0,y=0) => {
        if (c0 <= 1 && x < 0)
            y--;
        cs(c0 +x, c1 +y);
    }
    let graphics = {};
    ansi.handles['m'](cs,cp,c0,c1,term,graphics, 0);
    for (let i = 0; i < str.length; i++) {
        switch (str[i]) {
        case '\x07': /* Bell */ break;
        case '\x08': /* Backspace */ cp(-1); break;
        case '\x09': /* Tab */ cp(ansi.tab - (((c0 -1) % ansi.tab) +1)); break;
        case '\x0C': /* Form Feed */
        case '\x0A': /* Line Feed */ cp(0,1);
        case '\x0D': /* Carriage Return */ cs(1,c1); break;
        case '\x9B':
        case '\x1B':
            if (str[i +1] === '[') {
                const argStr = str
                    .slice(i +2)
                    .match(/^[0-9;]*/)[0];
                const cmd = str[argStr.length +i +2];
                if (!ansi.handles[cmd]) break;
                ansi.handles[cmd](cs,cp,c0,c1,term,graphics, ...argStr.split(';').map(Number));
                i += argStr.length +2;
                break;
            }
        default:
            let style = 'white-space: pre;';
            if (graphics.bold) style += 'font-weight: bold;';
            if (graphics.faint) style += 'font-weight: lighter;';
            if (graphics.italic) style += 'font-style: italic;';
            if (graphics.underline || graphics.overline || graphics.secondUnder || graphics.strikeout) 
                style += `text-decoration-line: ${graphics.underline || graphics.secondUnder 
                    ? 'underline'
                    : ''} ${graphics.overline 
                    ? 'overline' 
                    : ''} ${graphics.strikeout
                    ? 'line-through'
                    : ''};`;
            if (graphics.secondUnder) style += 'text-decoration-style: double;';
            if (graphics.hidden) style += 'display: none;';
            const forColor = graphics.reversed 
                ? typeof graphics.bacColor === 'number'
                    ? colors[graphics.bacColor]
                    : `rgb(${graphics.bacColor.join(',')})`
                : typeof graphics.forColor === 'number'
                    ? colors[graphics.forColor]
                    : `rgb(${graphics.forColor.join(',')})`;
            const bacColor = !graphics.reversed 
                ? typeof graphics.bacColor === 'number'
                    ? colors[graphics.bacColor]
                    : `rgb(${graphics.bacColor.join(',')})`
                : typeof graphics.forColor === 'number'
                    ? colors[graphics.forColor]
                    : `rgb(${graphics.forColor.join(',')})`;
            style += `color: ${forColor};`;
            style += `background-color: ${bacColor};`;
            if (typeof graphics.undColor === 'number') style += `text-decoration-color: ${colors[graphics.forColor]};`;
            else style += `text-decoration-color: rgb(${graphics.forColor.join(',')})`;

            term[c1 -1][c0 -1] = `<span style="${style}">${str[i]}</span>`;
            cp(1);
            break;
        }
    }

    return term.map(line => line.join('')).join('<br>');
} 
ansi.tab = 7;
ansi.handles = {
    'A'(cs,cp,c0,c1,term,g, n) { cp(0, +n || 1); },
    'B'(cs,cp,c0,c1,term,g, n) { cp(0, -(+n || 1)); },
    'C'(cs,cp,c0,c1,term,g, n) { cp(+n || 1); },
    'D'(cs,cp,c0,c1,term,g, n) { cp(-(+n || 1)); },
    'E'(cs,cp,c0,c1,term,g, n) { cp(0, +n || 1); cs(1,c1); },
    'F'(cs,cp,c0,c1,term,g, n) { cp(0, -(+n || 1)); cs(1,c1); },
    'G'(cs,cp,c0,c1,term,g, n) { cs(n,c1); },
    'H'(cs,cp,c0,c1,term,g, n,m) { cs(n || 1,m || 1); },
    'f'(cs,cp,c0,c1,term,g, n,m) { cs(n || 1,m || 1); },
    'J'(cs,cp,c0,c1,term,g, n = 0) {
        switch (n) {
        case 0: term[c1 -1] = term[c1 -1].slice(0, c0); break;
        case 1: 
            term[c1 -1] = new Array(c0).fill(' ')
                .concat(term.slice(c0));
            break;
        case 3:
        case 2: 
            term.splice(0, term.length); 
            cs(1,1);
            break;
        }
    },
    'K'(cs,cp,c0,c1,term,g, n = 0) {
        switch (n) {
        case 0: term[c1 -1] = term[c1 -1].slice(0, c0); break;
        case 1: 
            term[c1 -1] = new Array(c0).fill(' ')
                .concat(term.slice(c0));
            break;
        case 2: term[c1 -1] = []; break;
        }
    },
    'S'(cs,cp,c0,c1,term,g, n) {
        for (let i = 0; i < n; i++) 
            term.push([]);
        cp(0,-n);
    },
    'T'(cs,cp,c0,c1,term,g, n) {
        for (let i = 0; i < n; i++) 
            term.shift([]);
        cp(0,n);
    },
    'm'(cs,cp,c0,c1,term,graphics, n,m,r,g,b) {
        switch (n) {
        case 0: 
            graphics.bold = false;
            graphics.faint = false;
            graphics.italic = false;
            graphics.underline = false;
            graphics.hidden = false;
            graphics.strikeout = false;
            graphics.font = 0;
            graphics.secondUnder = false;
            graphics.forColor = 0;
            graphics.bacColor = 7;
            graphics.undColor = 0;
            graphics.reversed = false;
            graphics.overlined = false;
            break;
        case 1: graphics.bold = true; break;
        case 2: graphics.faint = true; break;
        case 3: graphics.italic = true; break;
        case 4: graphics.underline = true; break;
        case 7: graphics.reversed = true; break;
        case 8: graphics.hidden = true;
        case 9: graphics.strikeout = true;
        case 10: case 11: case 12: case 13: case 14: case 15: case 16: case 17: case 18: case 19: case 20:
            graphics.font = n - 10;
            break;
        case 21: graphics.secondUnder = true; break;
        case 22:
            graphics.bold = false;
            graphics.faint = false;
            break;
        case 23: graphics.italic = false; break;
        case 24:
            graphics.underline = false;
            graphics.secondUnder = false;
            break;
        case 27: graphics.reversed = false; break;
        case 28: graphics.hidden = false; break;
        case 29: graphics.strikeout = false; break;
        case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
            graphics.forColor = n - 30;
            break;
        case 38: graphics.forColor = m === 5 ? r : [r || 0,g || 0,b || 0]; break;
        case 39: graphics.forColor = 0; break;
        case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
            graphics.bacColor = n - 40;
            break;
        case 48: graphics.bacColor = m === 5 ? r : [r || 0,g || 0,b || 0]; break;
        case 49: graphics.bacColor = 7; break;
        case 53: graphics.overlined = true; break;
        case 55: graphics.overlined = false; break;
        case 58: graphics.undColor = m === 5 ? r : [r || 0,g || 0,b || 0]; break;
        case 59: graphics.undColor = graphics.forColor; break;
        case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97:
            graphics.forColor = (n - 90) + 8;
            break;
        case 100: case 101: case 102: case 103: case 104: case 105: case 106: case 107:
            graphics.forColor = (n - 100) + 8;
            break;
        }
    }
};
languages['ansi'] = ansi;
export function highlighter(lang, text) {
    const wrap = <div></div>;
    wrap.innerHTML = languages[lang]
        ? languages[lang](text)
        : text;
    return wrap;     
}