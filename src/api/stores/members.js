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
        this.nonce = 0;
        this.inTimeout = false;
        this.on('set', (key, old, val) => {
            if (val && val.user) {
                this.client.askFor('Users.set', val.user.id, val.user);
                val.user_id = val.user.id;
                delete val.user;
            }
        })
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
            for (const member of data.members) {
                member.guild_id = data.guild_id;
                this.set(data.guild_id + member.user.id, member);
            }
            if (data.chunk_index >= data.chunk_count -1) {
                const resolves = this.requests[data.nonce][1];
                if (Array.isArray(resolves)) {
                    for (const resolve of resolves)
                        resolve();
                } else resolves();
                delete this.requests[data.nonce];
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
    
    async batchLoad(guild, users) {
        let resolveFunc;
        const promise = new Promise(resolve => resolveFunc = resolve);
        const nonce = `${this.nonce++}`;
        this.requests[nonce] = [null, resolveFunc];

        this.client.send(GatewayOpcode.RequestGuildMembers, {
            guild_id: guild,
            user_ids: users
                .reduce((c,v) => (c.includes(v) || c.push(v), c), []),
            nonce: nonce
        });

        await promise;
    }
    async loadUser(guild, userId) {
        const id = guild + userId;
        if (!this.has(id)) {
            if (!this.inTimeout) {
                let resolveFunc;
                const promise = new Promise(resolve => resolveFunc = resolve);
                this.inTimeout = promise;
                const nonce = `${this.nonce}`;
                this.requests[nonce] = [userId, resolveFunc];
                setTimeout(() => {
                    this.inTimeout = false;
                    const users = Object.entries(this.requests)
                        .filter(([id]) => +id >= +nonce)
                        .map(([nonce, resolve]) => resolve);
                    this.batchLoad(guild, users.map(([id]) => id))
                        .then(() => resolveFunc());
                    this.requests[nonce][1] = users
                        .map(([id, resolve]) => resolve)
                }, 1);
            }
            await this.inTimeout;
        }
        return this.get(id);
    }
    async getMember(guild, userId) {
        const user = await this.client.askFor('getUser', userId);
        if (!guild) return user;
        const member = await this.loadUser(guild, userId);
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