import { PreloadedUserSettings } from '../setting-protos/user-settings.proto';
import { Base64Binary } from '../../b64-binnary.js';
import { IndexedMap } from '../indexed-map.js';
import { ChannelNotifications, GatewayOpcode, ActivityType, ProtoType } from '../type-enums.js';

export class Current {
    constructor(client) {
        this.client = client;
        this.settings = null;
        this.settingsNeedUploaded = false;
        this.guilds = new IndexedMap(true);
        this.timeout = false;
        this.changed = [];
        this.user = null;
        this.user_id = null;
        this.presence = {
            since: null,
            activities: [],
            status: 'online',
            afk: false
        };
        this.listens = ['READY'];
        setInterval(() => {
            if (!this.settingsNeedUploaded) return;
            this.settingsNeedUploaded = false;
            const binnary = PreloadedUserSettings.encode(this.settings);
            const data = Base64Binary.encode(binnary);
            this.client.fromApi(`PATCH /users/@me/settings-proto/${ProtoType.UserSettings}`, { settings: data });
        }, 600000);
    }
    setStatus(type, expires = Infinity) {
        this.presence.status = type;
        this.settings.status.status.value = type;
        this.settings.status.statusExpiresAtMs = expires;
        this.settingsNeedUploaded = true;
        this.client.send(GatewayOpcode.PresenceUpdate, this.presence);
    }
    setStatusText(txt, emote, expires = Infinity) {
        let status = this.presence.activities.find(act => act.type === ActivityType.Custom);
        if (!status) this.presence.activities.unshift(status = { type: ActivityType.Custom });
        status.state = txt;
        status.emoji = emote;
        this.settings.status.customStatus = {
            text: txt,
            emojiId: emote.id,
            emojiName: emote.name,
            createdAtMs: Date.now(),
            expiresAtMs: expires
        };
        this.settingsNeedUploaded = true;
        this.client.send(GatewayOpcode.PresenceUpdate, this.presence);
    }
    async setActivity(obj) {
        // respect settings on the client side aswell
        if (!this.settings.status.showCurrentGame.value) return; 
        let status = this.presence.activities.find(act => act.name === obj.name);
        if (!status) this.presence.activities.unshift(status = {});
        if (obj.assets) {
            const urls = await this.client.fromApi(`POST /applications/${obj.application_id}/external-assets`, {
                urls: [obj.assets.large_image, obj.assets.small_image]
            });
            obj.assets.large_image = 'mp:' + urls[0].external_asset_path;
            obj.assets.small_image = 'mp:' + urls[1].external_asset_path;
        }
        Object.assign(status, obj);
        this.client.send(GatewayOpcode.PresenceUpdate, this.presence);
    }
    removeActivity(name) {
        const idx = this.presence.activities.findIndex(act => act.id === name || act.name === name);
        this.presence.activities.splice(idx, 1);
        this.client.send(GatewayOpcode.PresenceUpdate, this.presence);
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY':
            this.user = data.user;
            this.user_id = data.user.id;
            const binnary = Base64Binary.decode(data.user_settings_proto);
            this.settings = PreloadedUserSettings.decode(binnary);
            if (this.settings.status.statusExpiresAtMs.ge(Date.now())) {
                this.settings.status.statusExpiresAtMs = Infinity;
                this.settings.status.status = 'online';
                this.settingsNeedUploaded = true;
            }
            this.setStatus(this.settings.status.status.value, this.settings.status.statusExpiresAtMs);
            if (this.settings.status.customStatus && this.settings.status.customStatus.expiresAtMs.lt(Date.now()))
                this.setStatusText(this.settings.status.customStatus.text, {
                    id: this.settings.status.customStatus.emojiId.toString(),
                    name: this.settings.status.customStatus.emojiName
                });
            this.client.send(GatewayOpcode.PresenceUpdate, this.presence);

            for (const { guild_id, ...guild } of data.user_guild_settings.entries)
                if (guild_id) {
                    guild.channel_overrides ??= [];
                    this.guilds.set(guild_id, guild);
                }
            break;
        }
    }
    getChannelSettings(id) {
        const settings = [...this.guilds].find(([id, settings]) => settings.channel_overrides.find(setting => setting.channel_id === id));
        if (!settings?.channel_overrides) return;
        return settings.channel_overrides.find(setting => setting.channel_id === id);
    }
    getGuildSettings(id) {
        return this.guilds.get(id);
    }
    setGuildSettings(settings) {
        if (!settings.id) {
            for (const channel of settings.channel_overrides) {
                const real = this.client.askFor('Channels.get', channel.id);
                this.setGuildSettings({
                    id: real.guild_id,
                    channel_overrides: [channel]
                });
            }
            return;
        }

        const id = settings.id;
        const channels = settings.channel_overrides;
        delete settings.channel_overrides;
        this.guilds.set(id, settings);
        const current = this.guilds.get(settings);
        for (const channel of current.channel_overrides) {
            const assign = channels.find(c => c.id === channel.id);
            if (!assign) continue;
            Object.assign(channel, assign);
        }

        if (!this.timeout) {
            this.timeout = true;
            this.changed.push(id);
            setTimeout(() => {
                const changes = Object.fromEntries(this.changed
                    .map(id => [id, this.guilds.get(id)]));
                this.client.fromApi('/users/@me/guilds/settings', changes);
                this.changed = [];
            }, 1000);
        } else this.changed.push(id);
    }
    getGuildSort(id) { 
        if (!this.settings?.guildFolders) return 0;
        const sort = this.settings.guildFolders.guildPositions.findIndex(guild => guild == id);
        return sort < 0 ? null : sort;
    }
    myServers() {
        const added = [];
        const folders = [];
        const guilds = this.client.store('Guilds');
        if (this.settings.guildFolders) {
            for (const folder of this.settings.guildFolders.folders) {
                added.push(...folder.guildIds.map(String));
                const servers = folder.guildIds
                    .map(guild => guilds.get(guild));
                const id = String(folder.id?.value ?? servers[0].id);
                added.push(id);
                const name = folder.name?.value ??
                    servers.length <= 1 
                        ? servers[0].name 
                        : servers
                            .slice(0, -1)
                            .map(folder => folder.name)
                            .join(', ') + 
                            ' and ' + servers[0].name
                folders.push({
                    id,
                    name,
                    color: folder.color?.value || 0x5865F2,
                    sort: this.getGuildSort(id),
                    servers
                });
            }
        }
        for (const [id, guild] of guilds) {
            if (!added.includes(id)) {
                folders.push({
                    id,
                    name: guild.name,
                    sort: this.getGuildSort(id),
                    color: 0x5865F2,
                    servers: [guild]
                });
            }
        }
        return folders.sort((a,b) => a.sort - b.sort);
    }
    async mentionsMe(message) {
        const channel = this.client.askFor('Channels.get', message.channel_id);
        const me = await this.client.askFor('getMember', channel.guild_id, this.user_id);
        return message.mention_everyone || 
            !!message.mentions.find(user => user.id === this.user_id) ||
            !!message.mention_roles.find(role => me.includes(role));
    }
    async firesNotification(message) {
        if (message.author.id === this.user_id) return false;
        const channel = this.client.askFor('Channels.get', message.channel_id);
        const guild = this.client.askFor('Guilds.get', channel?.guild_id);
        const notifAllow = (channel?.guild_id ?? this.user_id) === this.user_id
            ? ChannelNotifications.ALL_MESSAGES
            : !guild
                ? channel?.message_notifications ?? ChannelNotifications.ALL_MESSAGES
                : (channel?.message_notifications || 
                    (guild?.message_notifications +1) || 
                    (guild?.default_message_notifications +1)) || 
                    ChannelNotifications.ONLY_MENTIONS;
        if (notifAllow === ChannelNotifications.NOTHING) return false;
        if (notifAllow === ChannelNotifications.ALL_MESSAGES) return true;
        const me = !guild
            ? this.user
            : await this.client.askFor('getMember', guild?.id, this.user_id);
        return (message.mention_everyone && !guild?.suppress_everyone) || 
            !!message.mentions.find(user => user.id === this.user_id) ||
            (!!message.mention_roles.find(role => me.roles?.includes?.(role)) && !guild?.suppress_roles);
    }
}