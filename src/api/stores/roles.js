import { IndexedMap } from "../indexed-map.js";
import Long from "long";

export class Roles extends IndexedMap {
    // could do the "correct" thing and only include all of discords bits
    // but it is much simpler and easier to just say "every single bit on" instaed
    static AllPerms = Long.MAX_UNSIGNED_VALUE;
    constructor(client) {
        super(true);
        this.client = client;
        this.listens = [
            'READY',
            'GUILD_ROLE_CREATE', 'GUILD_ROLE_UPDATE', 'GUILD_ROLE_DELETE'
        ];
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY': 
            for (const guild of data.guilds) {
                for (const role of guild.roles) {
                    role.guild_id = guild.id;
                    this.set(role.id, role);
                }
            }
            break;
        case 'GUILD_ROLE_UPDATE':
        case 'GUILD_ROLE_CREATE': 
            data.role.guild_id = guild_id;
            this.set(data.role.id, data.role);
            break;
        case 'GUILD_ROLE_DELETE': 
            this.remove(data.role_id);
            break;
        }
    }
    totalRole(roles) {
        const sorted = roles
            .map(this.get.bind(this))
            .sort((a,b) => a.position - b.position);
        /** @type {Long} */
        const perms = sorted
            .map(({ permissions }) => Long.fromString(permissions, true, 10))
            .reduce((c,v) => v.or(c), 0);
        /** @type {number} */
        const colorRole = sorted.findLast(role => role.color);
        const iconRole = sorted.findLast(role => role.icon || role.unicode_emoji)
        return {
            crole: colorRole,
            irole: iconRole,
            ...sorted[0],
            color: '#' + (colorRole?.color || 0).toString(16).padStart(6, '0'),
            emoji: iconRole?.unicode_emoji,
            permissions: perms.shru(3).and(1) ? Roles.AllPerms : perms
        }
    }
}