import { FavoriteGIFTypes } from "../../api/type-enums";
import { toUrl } from "../../emojis";
import { Asset } from '../../api/asset-helper';

export class MediaPicker extends HTMLElement {
    static gifColumns = 2;
    constructor() {
        super();
        this.observer = new IntersectionObserver(this.intersectEnts.bind(this));
        this.attachShadow({ mode: 'open' });
    }
    async init() {
        this.shadowRoot.appendChild(
            <div style="
                width: 300px;
                height: 300px;
                border: 1px solid grey;
                padding: 4px;
                border-radius: 9px;
                margin-bottom: 10px;
                box-shadow: 0px 0px 10px black;
                display: grid;
                grid-template-rows: 22px 1fr;
            ">
                <div id="radio" style="
                    display: flex;
                    justify-content: center;
                    gap: 4px;
                ">
                    <button
                        id="media-favorites-picker-radio"
                        on:click={() => this.switchMenu('media-favorites-picker')} 
                        style="border: none; background: lightgray; border-radius: 4px;"
                    >GIF</button>
                    <button 
                        id="emoji-picker-radio"
                        on:click={() => this.switchMenu('emoji-picker')}
                        style="border: none; background: none; border-radius: 4px;"
                    >Emoji</button>
                    <button
                        id="sticker-picker-radio"
                        on:click={() => this.switchMenu('sticker-picker')}
                        style="border: none; background: none; border-radius: 4px;"
                    >Sticker</button>
                </div>
                <div 
                    style="
                        height: calc(300px - 27px);
                        overflow-y: scroll;
                        overflow-x: hidden;
                        position: absolute;
                        top: 29px;
                        width: 300px;
                    " 
                    id="scroller"
                    on:scrollend={() => this.render()}
                > 
                    <div style="width: 300px; position: absolute;" id="media-favorites-picker">
                        {(await this.client.askFor('getFavoriteGIFS'))
                            .map(({ link }) => <div id={link}></div>)}
                    </div>
                    <div style="width: 100%; height: 100%;" id="emoji-picker" hidden>
                        {this.client.askFor('getEmojisCategorized')
                            .map(([id, emotes]) => <details id={id}>
                                <summary style="margin-bottom: 0.3em;">{this.client.askFor('Guilds.get', id)?.name ?? id}</summary>
                                {emotes.map(({ id }) => <div id={id}></div>)}
                            </details>)}
                    </div>
                    <div style="width: 100%; height: 100%;" id="sticker-picker" hidden></div>
                </div>
            </div>
        );
    }
    fillGifTile(tile) {
        if (tile.children.length) return;
        const { src, width, height, type } = this.gifs[tile.id];
        switch (type) {
        default:
        case FavoriteGIFTypes.NONE:
        case FavoriteGIFTypes.IMAGE:
            tile.appendChild(<img 
                style="width: calc(100% - 4px); height: calc(100% - 4px); margin: 2px; border-radius: 4px;"
                src={src} 
                width={width} 
                height={height} 
            />); break;
        case FavoriteGIFTypes.VIDEO:
            tile.appendChild(<video 
                style="width: calc(100% - 4px); height: calc(100% - 4px); margin: 2px; border-radius: 4px;"
                width={width} 
                height={height} 
                autoplay={true} 
                loop={true} 
                controls={false}
            ><source src={src}/></video>); 
            break;
        }
    }
    intersectEnts(ents) {

    }
    static observedAttributes = ['client'];
    attributeChangedCallback(key, old, val) {
        switch (key) {
        case 'client': this.client = val; break;
        }
        this.init();
    }
}
customElements.define('media-picker', MediaPicker);
function makeEmojiTile(emote, isServer = true) {
    return <div style="width: 1.5em; height: 1.5em; margin: 1px; display: inline-block;" id={emote.id}>
        {isServer 
            ? Asset.CustomEmoji(emote, emote.animated ? 'gif' : 'png', 32, 'width: 100%; height: 100%; object-fit: contain;') 
            : <img src={toUrl(emote.surrogates)} style="width: 100%; height: 100%; object-fit: contain;"/>}
    </div>
}
function generateEmojiTiles() {
    const emojis = this.display.getElementById('emoji-picker');
    emojis.innerHTML = '';
    for (const [id, emotes, isServer] of this.client.askFor('getEmojisCategorized')) {
        const name = this.client.askFor('Guilds.get', id)?.name ?? id;
        const sort = this.client.askFor('getGuildSort', id) || '9999999999';
        emojis.appendChild(<details style="margin-bottom: 0.1em;" open id={`${id}-emoji`} sort={sort}>
            <summary style="margin-bottom: 0.3em;">{name}</summary>
            {emotes.map(emote => <div style="width: 1.5em; height: 1.5em; margin: 1px; display: inline-block;" id={emote.id} />)}
        </details>);
    }
}
async function initialize() {
    const gifs = this.display.getElementById('media-favorites-picker');
    gifs.style.height = `${Math.max(...tops)}px`;
    appendChildren(gifs, this.tiles.map(tile => tile[2]));
    this.render();
    this.generateEmojiTiles();
    this.client.askFor('Emojis.on', 'changed', (name, old, emote) => {
        if (!emote) {
            const emote = this.display.getElementById(old.id);
            const category = emote.parentElement;
            if (category.children.length <= 1) return category.remove();
            return emote.remove();
        }
        let container = this.display.getElementById(`${emote.guild_id}-emoji`);
        if (!container) {
            /** @type {HTMLElement} */
            const emojis = this.display.getElementById('emoji-picker');
            const name = this.client.askFor('Guilds.get', emote.guild_id)?.name ?? emote.guild_id;
            const sort = this.client.askFor('getGuildSort', id);
            container = <details style="margin-bottom: 0.1em;" open id={`${id}-emoji`} sort={sort}>
                <summary style="margin-bottom: 0.3em;">{name}</summary>
            </details>;
            const toPrepend = [...emojis.children].find(el => el.getAttribute('sort') > sort);
            toPrepend.before(container);
        }
        container.appendChild(this.makeEmojiTile(emote));
    });
}