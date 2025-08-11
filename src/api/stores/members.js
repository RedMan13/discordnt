import { LimitedStore } from "../store.js";
import { Member } from "../type-enums.js";
import { GatewayOpcode } from "../type-enums.js";

export class Members extends LimitedStore {
    constructor(client) {
        super(client, 0, 600, Member);
        this.listens = [
            'READY', 'READY_SUPPLEMENTAL',
            'GUILD_MEMBERS_CHUNK', 'GUILD_MEMBER_UPDATE', 'GUILD_MEMBER_REMOVE'
        ];
        this.requests = {};
        this.sent = {};
        setInterval(this.batchLoad.bind(this), 1500);
        this.on('set', (key, old, val) => {
            if (val && val.user) {
                this.client.askFor('Users.set', val.user.id, val.user);
                val.user_id = val.user.id;
                delete val.user;
            }
        });
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY':
        case 'READY_SUPPLEMENTAL':
            for (const [idx, guild] of Object.entries(data.merged_members)) {
                const guildId = data.guilds[idx].id;
                for (const member of guild) {
                    member.guild_id = guildId;
                    this.set(guildId + member.user_id, member);
                }
            }
            break;
        case 'GUILD_MEMBERS_CHUNK':
            const guildId = data.guild_id;
            for (const member of data.members) {
                member.guild_id = guildId;
                const userId = data.user?.id ?? data.user_id;
                this.set(guildId + userId, member);
                const promises = this.requests[guildId]?.[userId];
                if (!promises) continue;
                while (promises.length)
                    promises.pop().resolve(member);
                delete this.requests[guildId][userId];
                delete this.sent[guildId];
            }
            for (const userId of data.not_found) {
                const promises = this.requests[guildId]?.[userId];
                if (!promises) continue;
                while (promises.length)
                    promises.pop().reject();
                delete this.requests[guildId][userId];
                delete this.sent[guildId];
            }
            break;
        case 'GUILD_MEMBER_UPDATE':
            if (!this.has(data.guild_id + data.user.id)) break;
            this.set(data.guild_id + data.user.id, data);
            break;
        case 'GUILD_MEMBER_REMOVE':
            this.remove(data.guild_id + data.user.id);
            break;
        }
    }
    
    batchLoad() {
        for (const guild in this.requests) {
            if (this.sent[guild]) continue;
            const users = Object.keys(this.requests[guild]);
            if (users.length <= 0) continue;
            this.client.send(GatewayOpcode.RequestGuildMembers, {
                guild_id: guild,
                user_ids: users
            });
            this.sent[guild] = true;
        }
    }
    queueLoad(guild, userId) {
        if (this.has(guild + userId)) return Promise.resolve(this.get(guild + userId));
        return new Promise((resolve, reject) => {
            this.requests[guild] ??= {};
            this.requests[guild][userId] ??= [];
            this.requests[guild][userId].push({ resolve, reject });
        });
    }
    async getMember(guild, userId) {
        if (!userId) return;
        const user = await this.client.askFor('getUser', userId);
        if (!guild || guild === this.client.askFor('user_id')) return user;
        const member = await this.queueLoad(guild, userId);
        if (!member) return user;
        const topRole = this.client.askFor('totalRole', member.roles);
        return {
            ...user,
            ...member,
            top_role: topRole,
            username: member.nick ?? user.username,
            avatar: user.avatar,
            banner: user.banner,
            alt_avatar: member.avatar,
            alt_banner: member.banner,
            avatar_decoration_data: member.avatar_decoration_data ?? user.avatar_decoration_data
        }
    }
}