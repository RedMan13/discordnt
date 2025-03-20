import { LimitedStore } from "../store.js";
import { Guild } from "../type-enums.js";
import { Asset } from "../asset-helper.js";

export class Guilds extends LimitedStore {
    constructor(client) {
        super(client, 0, Infinity, Guild);
        this.listens = [
            'READY',
            'GUILD_CREATE', 'GUILD_UPDATE', 'GUILD_DELETE',
            'GUILD_BAN_ADD', 'GUILD_BAN_REMOVE',
            'GUILD_MEMBER_ADD', 'GUILD_MEMBER_REMOVE', 'GUILD_MEMBER_UPDATE'
        ];
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY':
            for (const server of data.guilds) {
                const guild = { ...server };
                delete guild.channels;
                delete guild.threads;
                // why discord, why
                Object.assign(guild, guild.properties);
                delete guild.properties;
                delete guild.guild_scheduled_events;
                this.set(guild.id, guild);
            }
            break;
        case 'GUILD_UPDATE':
        case 'GUILD_CREATE': 
            delete data.channels;
            delete data.members;
            delete data.threads;
            this.set(data.id, data);
            break;
        case 'GUILD_DELETE': 
            this.remove(data.id);
            break;
        }
    }
    get(id) {
        const guild = super.get(id);
        if (!guild) return guild;
        const settings = { ...this.client.askFor('getGuildSettings', guild.id) };
        if (!settings) return guild;
        delete settings.guild_id;
        delete settings.channel_overrides;
        return Object.assign(guild, settings);
    }
    toFolder(id) {
        id = `${id}`;
        const guild = this.get(id);
        if (!guild) return;
        const channels = this.client.askFor('Channels.toFolders', id) ?? [];
        return {
            name: guild.name,
            icon: Asset.GuildIcon(guild, 'webp', 64),
            members: channels,
        }
    }
    async searchForIn(guild, props) {
        if (props.during) {
            const date = BigInt(new Date(new Date(props.during).toDateString()));
            props.before = date + (24n * 60n * 60n * 1000n);
            props.after = date;
        }
        return this.client.fromApi(`GET /guilds/${guild}/messages/search`, {
            author_id: props.author?.id ?? props.author?.user_id ?? props.author_id ?? props.author,
            mentions: props.mentions?.id ?? props.mentions?.user_id ?? props.mentions_id ?? props.mentions,
            channel_id: props.channel?.id ?? props.channel_id ?? props.channel,
            pinned: props.pinned,
            has: props.has,
            content: props.content,
            max_id: ((BigInt(props.before) - 1420070400000n) << 22n) || props.before,
            min_id: ((BigInt(props.after) - 1420070400000n) << 22n) || props.after
        });
    }
}