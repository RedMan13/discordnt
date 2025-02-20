export const MessageEditor = <define
    this={{
        async send() {
            /** @type {HTMLTextAreaElement} */
            const editor = this.display.getElementById('editor');
            const here = client.askFor('Messages.channel');
            await client.fromApi(`POST /channels/${here}/messages`, {
                content: editor.value
            });
            editor.value = '';
        }
    }}
>
    <div style="
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
            on:keypress={e => {
                if (e.shiftKey) return;
                if (e.key !== 'Enter') return;
                this.send();
            }}
        ></div>
        <button 
            on:click={this.send} 
            style="margin-left: 5px;"
        >Send</button>
    </div>
</define>