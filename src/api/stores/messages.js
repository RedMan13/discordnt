import { LimitedStore } from "../store.js";
import { Message } from "../type-enums.js";

export class Messages extends LimitedStore {
    constructor(client, channel) {
        super(client, 100, 100, Message);
        this.center = null;
        this.offset = null;
        this.channel = null;
        this.guild = null;
        if (channel || location.hash) 
            this.moveto(channel ?? location.hash.slice(1))
        if (this.channel) this.fill(100);
        this.listens = [
            'MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'MESSAGE_DELETE_BULK',
            'MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE', 'MESSAGE_REACTION_REMOVE_ALL', 'MESSAGE_REACTION_REMOVE_EMOJI',
            'CHANNEL_PINS_UPDATE'
        ];
        window.onhashchange = () => this.moveto(location.hash.slice(1));
        this.on('set', (key, old, val) => {
            if (val && val.author?.id && !val.webhook_id) {
                this.client.askFor('Users.set', val.author.id, val.author);
                val.author_id = val.author.id;
                delete val.author;
            }
            if (val && val.referenced_message && val.referenced_message.author && !val.referenced_message.webhook_id) {
                this.client.askFor('Users.set', val.referenced_message.author.id, val.referenced_message.author);
                val.referenced_message.author_id = val.referenced_message.author.id;
                delete val.author;
            }
        })
    }
    notify(ev, data) {
        if (data.channel_id !== this.channel) return;
        switch (ev) {
        case 'MESSAGE_CREATE': this.push(data.id, data); break;
        case 'MESSAGE_UPDATE': 
            if (this.has(data.id)) this.set(data.id, data);
            break;
        case 'MESSAGE_DELETE': this.delete(data.id); break;
        case 'MESSAGE_DELETE_BULK': this.bulkDel(data.ids); break;
        case 'MESSAGE_REACTION_ADD': {
            const message = this.get(data.message_id);
            if (!message) break;
            message.reactions ??= [];
            const reaction = message.reactions.find(({ emoji }) => emoji.name === data.emoji.name && emoji.id === data.emoji.id);
            const me = this.client.askFor('user_id');
            if (!reaction) {
                message.reactions.push({
                    count: 1,
                    count_details: { 
                        burst: data.burst ? 1 : 0, 
                        normal: data.burst ? 0 : 1 
                    },
                    me: !data.burst && data.user_id === me,
                    me_burst: data.burst && data.user_id === me,
                    emoji: data.emoji,
                    burst_colors: data.burst_colors
                });
                break;
            }
            reaction.count++;
            if (data.burst) reaction.count_details.burst++;
            else reaction.count_details.normal++;
            reaction.me = !data.burst && data.user_id === me;
            reaction.me_burst = data.burst && data.user_id === me;
            this.set(data.message_id, message);
            break;
        }
        case 'MESSAGE_REACTION_REMOVE': {
            const message = this.get(data.message_id);
            if (!message) break;
            message.reactions ??= [];
            const reaction = message.reactions.find(({ emoji }) => emoji.name === data.emoji.name && emoji.id === data.emoji.id);
            if (!reaction) break;
            const me = this.client.askFor('user_id');
            reaction.count++;
            if (data.burst) reaction.count_details.burst--;
            else reaction.count_details.normal--;
            reaction.me = !data.burst && data.user_id === me;
            reaction.me_burst = data.burst && data.user_id === me;
            this.set(data.message_id, message);
            break;
        }
        case 'MESSAGE_REACTION_REMOVE_ALL': {
            const message = this.get(data.message_id);
            if (!message) break;
            message.reactions = [];
            this.set(data.message_id, message);
            break;
        }
        case 'MESSAGE_REACTION_REMOVE_EMOJI': {
            const message = this.get(data.message_id);
            if (!message) break;
            message.reactions ??= [];
            const reaction = message.reactions.findIndexOf(({ emoji }) => emoji.name === data.emoji.name && emoji.id === data.emoji.id);
            if (reaction <= -1) return;
            message.reactions.splice(reaction, 1);
            this.set(data.message_id, message);
            break;
        }
        }
    }
    async getMessage(channel, id) {
        return await this.client.fromApi(`GET /channels/${channel}/messages`, {
            around: id,
            limit: 1
        });
    }
    async fill(len) {
        if (!this.channel) return;

        const messages = await this.client.fromApi(`GET /channels/${this.channel}/messages`, {
            limit: len,
            ...(len < 100 
                ? { after: this.get(-1) } 
                : { [this.offset]: this.center })
        }).catch(() => {});
        if (!messages) return this.emit('failed');
        if (this.guild)
            // make requests for all the members in this message list
            // we dont await this as to not hold up on actually viewing the messages
            this.client.askFor('Members.batchLoad', this.guild, messages.map(msg => msg.author_id || msg.author.id));
        for (const message of messages)
            this.shift(message.id, message, true);
        this.emit('loaded');
    }
    moveto(channel) {
        this.channel = channel;
        this.guild = this.client.askFor('Channels.get', channel)?.guild_id;
        this.offset = null;
        this.center = null;
        this.clear();
        this.emit('moved', channel);
    }
    goto(message) {
        this.offset = 'around';
        this.center = message;
        this.clear();
    }
    isChildMessage(id) {
        const parent = this.get(this.indexOf(id) -1);
        if (!parent || parent.id === id) return false;
        const message = this.get(id);
        const before = new Date(parent.timestamp);
        const after = new Date(message.timestamp);
        const inTimeframe = Math.abs(after - before) < 2 * 60 * 60 * 1000;
        if (!(parent.author_id ?? parent.author.id)) return;
        if (!(message.author_id ?? message.author.id)) return;
        const isUser = (parent.author_id ?? parent.author.id) === (message.author_id ?? message.author.id);
        return inTimeframe && isUser;
    }
}