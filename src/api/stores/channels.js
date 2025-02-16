import { LimitedStore } from "../store.js";
import { Channel, ChannelType } from "../type-enums.js";

export class Channels extends LimitedStore {
    constructor(client) {
        super(client, 0, Infinity, Channel);
        this.listens = [
            'READY', 'CHANNEL_CREATE', 'CHANNEL_UPDATE', 'CHANNEL_DELETE',
            'THREAD_CREATE', 'THREAD_UPDATE', 'THREAD_DELETE', 'THREAD_LIST_SYNC'
        ]
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY':
            for (const guild of data.guilds) {
                for (const channel of guild.channels) {
                    channel.guild_id = guild.id;
                    this.set(channel.id, channel);
                }
                for (const thread of guild.threads) {
                    const channel = { ...thread };
                    channel.guild_id = guild.id;
                    delete channel.member_ids_preview;
                    delete channel.member_ids;
                    this.set(channel.id, channel);
                }
            }
            for (const channel of data.private_channels) {
                if (channel.type === ChannelType.DM && !data.relationships.find(user => user.id === channel.id)) 
                    continue; // ignore user channels that have no relations (those users arnt included anywhere else)
                channel.guild_id = data.user.id;
                this.set(channel.id, channel);
            }
            break;
        case 'THREAD_CREATE':
        case 'CHANNEL_CREATE':
            delete data.member_ids;
            this.set(data.id, data);
            break;
        case 'THREAD_UPDATE':
        case 'CHANNEL_UPDATE':
            delete data.member_ids;
            this.set(data.id, data);
            break;
        case 'THREAD_DELETE':
        case 'CHANNEL_DELETE':
            delete data.member_ids;
            this.delete(data.id);
            break;
        case 'THREAD_LIST_SYNC':
            for (const channel of data.threads) {
                channelguild_id = data.guild_id;
                this.set(channel.id, channel);
            }
            break;
        }
    }
    get(id) {
        const channel = super.get(id);
        if (!channel) return channel;
        const settings = { ...this.client.askFor('getChannelSettings', channel.id) };
        if (!settings) return channel;
        delete settings.channel_id;
        return Object.assign(channel, settings);
    }
    forGuild(id) {
        return [...this]
            .map(([id, channel]) => channel)
            .filter(channel => channel.guild_id === id);
    }
    toFolders(guild) {
        const channels = this.forGuild(guild);
        const members = [];
        const tree = {};
        for (const channel of channels) {
            tree[channel.id] = {
                id: channel.id,
                sort: channel.position,
                collapsed: channel.collapsed,
                type: channel.type,
                name: channel.name,
                members: tree[channel.id]?.members
            };
            if (channel.parent_id) {
                tree[channel.parent_id] ??= {};
                tree[channel.parent_id].members ??= [];
                tree[channel.parent_id].members.push(tree[channel.id]);
            } else {
                members.push(tree[channel.id])
            }
        }
        return members;
    }
}