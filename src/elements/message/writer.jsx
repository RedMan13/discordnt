import { format, writerSyntax, styles } from "./render-md";
import { MediaPicker } from "./media-picker.jsx";

// this is fucking dumb as shit
// why on earth wont the fucking browser just let me have a TEXT cursor, 
// a cursor that is set to a CHARACTER position and reads back as TEXT location
/**
 * get an ACTUAL cursor position, instead of dumb ass bullshit we cant do anything with
 * @param {Range} range 
 * @param {HTMLElement} top 
 */
function resolveTextCursor(range, top) {
    let start = range.startOffset;
    let foundStart = false;
    let end = range.endOffset;
    let foundEnd = false;
    /** @param {HTMLElement} el */
    const recur = el => {
        for (const child of el.childNodes) {
            if (range.startContainer === child) foundStart = true;
            if (range.endContainer === child) foundEnd = true;
            if (foundStart && foundEnd) break;
            if (child.nodeType === child.TEXT_NODE) {
                if (!foundStart) start += child.textContent.length;
                if (!foundEnd) end += child.textContent.length;
                continue;
            }
            recur(child);
        }
    }
    recur(top);
    return [start, end];
}
/**
 * @param {Range} range 
 * @param {number} start 
 * @param {number} end 
 * @param {HTMLElement} top 
 */
function applyCursorPosition(range, start, end, top) {
    let appliedStart = false;
    let appliedEnd = false;
    const recur = el => {
        for (const child of el.childNodes) {
            if (appliedStart && appliedEnd) break;
            if (child.nodeType === child.TEXT_NODE) {
                if (start <= child.textContent.length) {
                    appliedStart = true;
                    range.setStart(child, start);
                }
                if (end <= child.textContent.length) {
                    appliedEnd = true;
                    range.setEnd(child, end);
                }
                if (!appliedStart) start -= child.textContent.length;
                if (!appliedEnd) end -= child.textContent.length;
                continue;
            }
            recur(child);
        }
    }
    recur(top);
}
export const MessageEditor = <define
    styles={styles}
    this={{
        async send() {
            /** @type {HTMLTextAreaElement} */
            const editor = this.display.getElementById('editor');
            const here = client.askFor('Messages.channel');
            await client.fromApi(`POST /channels/${here}/messages`, {
                content: editor.textContent
            });
            editor.value = '';
        }
    }}
>
    <MediaPicker hidden id="media-picker" style="position: absolute; right: 10px; bottom: 80px; "/>
    <div class="message-render" style="
        display: grid;
        font: inherit;
        grid-template-columns: minmax(auto, 1fr) auto;
        padding: 10px;
        border-radius: 10px;
        border: grey solid 1px;
        margin-bottom: 10px;
        margin-left: 10px;
        margin-right: 10px;
        position: relative;
    ">
        <div 
            id="editor" 
            rows="1" 
            style="
                width: 100%; 
                padding: 0; 
                border: none;
                resize: none;
                font-family: 'Open Sans', serif;
            " 
            autofocus 
            contenteditable
            on:keyup={async e => {
                /** @type {HTMLDivElement} */
                const editor = this.display.getElementById('editor');
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                const [start, end] = resolveTextCursor(range, editor);
                const entered = editor.textContent;
                editor.innerHTML = '';
                const formated = await format(entered, false, writerSyntax);
                appendChildren(editor, formated);
                applyCursorPosition(range, start, end, editor);
                if (e.shiftKey) return;
                if (e.key !== 'Enter') return;
                this.send();
            }} 
        ></div><br/>
        <button on:click={() => {
            const picker = this.display.getElementById('media-picker');
            picker.hidden = !picker.hidden;
        }}>show your mom</button>
        <button 
            on:click={() => this.send()} 
            style="margin-left: 5px;"
        >🖅</button>
    </div>
</define>