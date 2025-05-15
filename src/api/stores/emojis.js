import { IndexedMap } from "../indexed-map";
import { default as Emotes, Categories } from '../../emojis';

export class Emojis extends IndexedMap {
    static internals = Object.entries(Categories).map(([name, range]) => [name, Emotes.slice(...range), false])
    constructor(client) {
        super(true);
        this.client = client;
        this.listens = [
            'READY',
            'GUILD_EMOJIS_CREATE', 'GUILD_EMOJIS_UPDATE', 'GUILD_EMOJIS_REMOVE',
            'GUILD_STICKERS_CREATE', 'GUILD_STICKERS_UPDATE', 'GUILD_EMOJIS_REMOVE'
        ];
    }
    notify(ev, data) { 
        switch (ev) {
        case 'READY':
            for (const guild of data.guilds) {
                for (const emoji of guild.emojis) {
                    let i = 0;
                    const name = emoji.name;
                    while (this.has(emoji.name))
                        emoji.name = `${name}~${++i}`;
                    emoji.sticker = false;
                    emoji.guild_id = guild.id;
                    this.set(emoji.name, emoji);
                }
                for (const sticker of guild.stickers) {
                    let i = 0;
                    const name = sticker.name;
                    while (this.has(sticker.name))
                        sticker.name = `${name}~${++i}`;
                    sticker.sticker = true;
                    sticker.guild_id = guild.id;
                    this.set(sticker.name, sticker);
                }
            }
            break;
        case 'GUILD_EMOJIS_UPDATE':
        case 'GUILD_EMOJIS_CREATE':
            for (const emoji of data.emojis) {
                let i = 0;
                const name = emoji.name;
                while (this.some(([_, emote]) => emote.name === emoji.name && emote.id !== emoji.id))
                    emoji.name = `${name}~${++i}`;
                emoji.sticker = false;
                emoji.guild_id = data.guild_id;
                this.set(emoji.name, emoji);
            }
            break; 
        case 'GUILD_EMOJIS_UPDATE':
        case 'GUILD_EMOJIS_CREATE':
            for (const emoji of data.emojis) {
                const name = this.find(([_, emote]) => emote.id === emoji.id)[0];
                if (!name) {
                    let i = 0;
                    const name = emoji.name;
                    while (this.has(emoji.name))
                        emoji.name = `${name}~${++i}`;
                } else emoji.name = name;
                emoji.sticker = false;
                emoji.guild_id = data.guild_id;
                this.set(name, emoji);
            }
            break;
        case 'GUILD_EMOJIS_REMOVE':
            for (const emoji of data.emoji_ids) this.delete(this.find(emote => emote.id === emoji)[0]);
            break;
        case 'GUILD_STICKERS_UPDATE':
        case 'GUILD_STICKERS_CREATE':
            for (const sticker of data.stickers) {
                const name = this.find(([_, emote]) => emote.id === sticker.id)[0];
                if (!name) {
                    let i = 0;
                    const name = sticker.name;
                    while (this.has(sticker.name))
                        sticker.name = `${name}~${++i}`;
                } else sticker.name = name;
                sticker.sticker = true;
                sticker.guild_id = data.guild_id;
                this.set(name, sticker);
            }
            break;
        case 'GUILD_EMOJIS_REMOVE':
            for (const sticker of data.stickers) this.delete(this.find(emote => emote.id === sticker)[0]);
            break;
        }
    }
    getEmojisCategorized() {           
        const res = {};
        for (const [name, emote] of this) {
            if (emote.sticker) continue;
            if (!(emote.guild_id in res))
                res[emote.guild_id] = [];
            res[emote.guild_id].push(emote);
        }
        return Object.entries(res)
            .sort(([a],[b]) => this.client.askFor('getGuildSort', a) - this.client.askFor('getGuildSort', b))
            .map(([id, emotes]) => [id, emotes, true])
            .concat(Emojis.internals);
    }
}