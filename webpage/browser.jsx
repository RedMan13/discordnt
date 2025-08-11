/** @import { BrowserFolder } from './builder/precomp-manager.js' */
const sortOrder = 'abcdefghijklmnopqrstuvwxyz1234567890';
/**
 * makes a browser
 * @param {BrowserFolder} json - the filesystem-shape to be displayed in the browser
 * @param {boolean} makeTop - if or if not to return only the inner members of the folder or the raw folder
 * @return {HTMLDivElement} - the browser
 */      
function makeBrowser(json, makeTop = true) {
    /** @type {HTMLDivElement} */
    const folder = <div 
        class={`folder ${
            json.resolve || json.selected 
                ? 'opened' 
                : 'closed'
        } ${!json.icon 
                ? json.resolve 
                    ? 'resolves'
                    : 'noicon' 
                : ''
        }`}
        on:click={e => {
            e.stopPropagation();
            if (!json.resolve) {
                folder.classList.toggle('opened');
                folder.classList.toggle('closed');
            } else window.open(json.resolve, '_self');
        }}
    >
        {json.icon
            ? <img src={json.icon} />
            : null
        }
        <span>{json.name}</span>
        <div>{
            json.members.sort((a,b) => {
                const aHasSort = typeof a.sort !== 'undefined';
                const bHasSort = typeof b.sort !== 'undefined'; 
                const aHasName = typeof a.name !== 'undefined';
                const bHasName = typeof b.name !== 'undefined'; 
                if (a.members && b.resolve && !aHasSort) return -1;
                if (a.resolve && b.members && !bHasSort) return 1;
                const aName = (!aHasSort && aHasName)
                    ? [...a.name.toLowerCase()]
                        .reverse()
                        .map((char, idx) => sortOrder.indexOf(char) * idx)
                        .reduce((pre, cur) => pre + cur, 0)
                    : a.sort;
                const bName = (!bHasSort && bHasName)
                    ? [...b.name.toLowerCase()]
                        .reverse()
                        .map((char, idx) => sortOrder.indexOf(char) * idx)
                        .reduce((pre, cur) => pre + cur, 0)
                    : b.sort;
                return aName - bName;
            })
            .map(file => Array.isArray(file.members) 
                ? makeBrowser(file, false)
                : <div class={`file ${
                    file.selected 
                        ? 'selected' 
                        : ''
                    } ${!file.icon 
                        ? 'noicon' 
                        : ''
                    }`}
                    on:click={e => {
                        e.stopPropagation();
                        window.open(file.resolve, '_self');
                    }}
                >
                    {file.icon
                        ? <img src={file.icon} />
                        : null
                    }
                    <span>{file.name}</span>
                </div>)
        }</div>
    </div>;
    return makeTop ? folder.getElementsByTagName('div')[0] : folder;
}
function interpol(start, end, percent) {
    return start + (end - start) * percent;
}

/** @type {HTMLDivElement} */
const browser = document.getElementById('browser');
/** @type {HTMLButtonElement} */
const close = document.getElementById('close-browser');
/** @type {HTMLDivElement} */
const resize = document.getElementById('resize');       

let toOpen = 0;
let start = null;
let holdingResize = false;
function getMaxBrowserWidth() {
    return browser.parentElement.clientWidth - close.offsetWidth;
}
function getBrowserWidth() {
    return +browser.style.width.slice(0, -2);
}
function setBrowserWidth(width) {
    localStorage.broswerLeft = width;
    browser.style.width = `${width}px`;
    if (browser.classList.contains('close')) {
        browser.style.left = `${-width}px`;
    } else {
        close.style.left = `${width}px`;
        resize.style.left = `${width - 5}px`;
    }
}
function setBrowserPosition(pos) {
    browser.style.left = `${pos - getBrowserWidth()}px`;
    close.style.left = `${pos}px`;
    resize.style.left = `${pos - 5}px`;
}
function enableBrowser() {
    browser.hidden = false;
    close.hidden = false;
}
function clearBrowser() {
    browser.innerHTML = '';
}
function copySelections(pages) {
    for (const el of browser.children) {
        const selNam = el.getElementsByTagName('span')[0];
        const folder = pages.find(({ name }) => selNam === name);
        if (!folder || !folder.members) continue;
        copySelections(folder.members);
        folder.selected = el.classList.has('opened');
    }
}
function updateBrowser(pages) {
    if (!pages?.members) return;
    const html = makeBrowser(pages);
    html.style.width = 'max-content';
    copySelections(pages.members);
    clearBrowser();
    browser.appendChild(html);
}

close.onclick = e => {
    browser.classList.toggle('open');
    browser.classList.toggle('close');
    close.classList.toggle('open');
    close.classList.toggle('close');
    close.innerText = close.classList.contains('open') ? '<' : '>';
    const width = +browser.style.width.slice(0, -2);
    toOpen = close.classList.contains('open') ? 2 : -2;
}

resize.onmousedown = e => {
    e.preventDefault();
    holdingResize = true;
}
document.onmouseup = () => holdingResize = false;
document.onmousemove = e => {
    e.preventDefault();
    if (!holdingResize) return;
    if (browser.classList.contains('close')) {
        toOpen = 0;
        setBrowserWidth(0);
        setBrowserPosition(0);
        browser.style.boxShadow = `0 0 20px black`;
        close.innerText = '<';
        browser.classList.add('open');
        browser.classList.remove('close');
        close.classList.add('open');
        close.classList.remove('close');
    }
    const maxWidth = getMaxBrowserWidth();
    const width = getBrowserWidth();
    setBrowserWidth(Math.max(Math.min(width + (e.movementX / window.scale), maxWidth), 0))
}

function tick(timer) {
    requestAnimationFrame(tick);
    if (!toOpen) return;
    const width = +browser.style.width.slice(0, -2);
    const goal = toOpen < 0 ? 0 : width
    const butLeft = +close.style.left.slice(0, -2);
    if (Math.abs(toOpen) >= 2) {
        start = timer;
        toOpen = Math.sign(toOpen);
    }
    if (Math.abs(goal - butLeft) < 0.5) {
        setBrowserPosition(goal, false);
        browser.style.boxShadow = `0 0 ${toOpen < 0 ? 0 : 20}px black`;
        toOpen = 0;
        return;
    }
    const inter = Math.abs(timer - start) / 500;
    const resLeft = interpol(butLeft, goal, inter);
    setBrowserPosition(resLeft, false);
    const shadow = +browser.style.boxShadow.split(' ')[2].slice(0, -2);
    const resShadow = interpol(shadow, toOpen < 0 ? 0 : 20, inter);
    browser.style.boxShadow = `0 0 ${resShadow}px black`;
}
requestAnimationFrame(tick);

/** @type {BrowserFolder} */
const files = JSON.parse(browser.innerText);
/** @type {Array<string>} */
const pages = (localStorage.pages || location.pathname).split(',');
if (!pages.includes(location.pathname)) pages.push(location.pathname);
if (files.pages <= pages.length || true) {
    enableBrowser();
    updateBrowser(files);
}
localStorage.pages = pages.join();
setBrowserWidth(+localStorage.broswerLeft || 180);

window.enableBrowser = enableBrowser;
window.clearBrowser = clearBrowser;