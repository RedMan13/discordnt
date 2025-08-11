import { format, writerSyntax, styles } from "./render-md.jsx";
import { MediaPicker } from "./media-picker.jsx";
import quillStyles from 'quill/dist/quill.bubble.css';
import Quill from '../../../preprocessors/babel-deshitifier!quill';

export const MessageEditor = <define
    styles={[styles,quillStyles]}
    this={{
        async send() {
            /** @type {HTMLTextAreaElement} */
            const editor = this.display.getElementById('editor');
            const here = this.client.askFor('Messages.channel');
            await this.client.fromApi(`POST /channels/${here}/messages`, {
                content: this.quill.getText()
            });
            this.quill.setText('');
        },
        quill: null
    }}
    on:connected={function() {
        if (!this.quill) {
            const editor = this.display.getElementById('editor');
            const quill = this.quill = new Quill(editor, {
                theme: 'bubble'
            });
            // copied from https://github.com/slab/quill/issues/2021#issuecomment-1776007758
            const hasShadowRootSelection = !!(document.createElement('div').attachShadow({ mode: 'open' }).getSelection);
            // Each browser engine has a different implementation for retrieving the Range
            const getNativeRange = (rootNode) => {
                try {
                    if (hasShadowRootSelection) {
                        // In Chromium, the shadow root has a getSelection function which returns the range
                        return rootNode.getSelection().getRangeAt(0);
                    } else {
                        const selection = window.getSelection();
                        if (selection.getComposedRanges) {
                            // Webkit range retrieval is done with getComposedRanges (see: https://bugs.webkit.org/show_bug.cgi?id=163921)
                            return selection.getComposedRanges(rootNode)[0];
                        } else {
                            // Gecko implements the range API properly in Native Shadow: https://developer.mozilla.org/en-US/docs/Web/API/Selection/getRangeAt
                            return selection.getRangeAt(0);
                        }
                    }
                } catch {
                    return null;
                }
            }

            /** 
             * Original implementation uses document.active element which does not work in Native Shadow.
             * Replace document.activeElement with shadowRoot.activeElement
             **/
            quill.selection.hasFocus = function () {
                const rootNode = quill.root.getRootNode();
                return rootNode.activeElement === quill.root;
            }

            /** 
             * Original implementation uses document.getSelection which does not work in Native Shadow. 
             * Replace document.getSelection with shadow dom equivalent (different for each browser)
             **/
            quill.selection.getNativeRange = function () {
                const rootNode = quill.root.getRootNode();
                const nativeRange = getNativeRange(rootNode);
                return !!nativeRange ? quill.selection.normalizeNative(nativeRange) : null;
            };

            /**
             * Original implementation relies on Selection.addRange to programatically set the range, which does not work
             * in Webkit with Native Shadow. Selection.addRange works fine in Chromium and Gecko.
             **/
            quill.selection.setNativeRange = function (startNode, startOffset) {
                var endNode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : startNode;
                var endOffset = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : startOffset;
                var force = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
                if (startNode != null && (quill.selection.root.parentNode == null || startNode.parentNode == null || endNode.parentNode == null)) {
                    return;
                }
                var selection = document.getSelection();
                if (selection == null) return;
                if (startNode != null) {
                    if (!quill.selection.hasFocus()) quill.selection.root.focus();
                    var native = (quill.selection.getNativeRange() || {}).native;
                    if (native == null || force || startNode !== native.startContainer || startOffset !== native.startOffset || endNode !== native.endContainer || endOffset !== native.endOffset) {
                        if (startNode.tagName == "BR") {
                            startOffset = [].indexOf.call(startNode.parentNode.childNodes, startNode);
                            startNode = startNode.parentNode;
                        }
                        if (endNode.tagName == "BR") {
                            endOffset = [].indexOf.call(endNode.parentNode.childNodes, endNode);
                            endNode = endNode.parentNode;
                        }
                        selection.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
                    }
                } else {
                    selection.removeAllRanges();
                    quill.selection.root.blur();
                    document.body.focus();
                }
            }

            /**
             * Subscribe to selection change separately, because emitter in Quill doesn't catch this event in Shadow DOM
             **/
            const handleSelectionChange = function () {
                quill.selection.update();
            };

            document.addEventListener("selectionchange", handleSelectionChange);
        }
    }}
    attributes={['client']}
    on:attributes={function (key, old, newVal) {
        switch (key) {
        case 'client': this.client = newVal; break;
        }
    }}
>
    <MediaPicker client={this.client} hidden id="media-picker" style="position: absolute; right: 10px; bottom: 80px; "/>
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