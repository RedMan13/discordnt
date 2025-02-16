import { LimitedStore } from "../store.js";
import { User } from "../type-enums.js";
import { Asset } from "../asset-helper.js";

export class Users extends LimitedStore {
    constructor(client) {
        // min-num of users per conversation seems to roughly be 6, 
        // mult by the max num servers (100)
        super(client, 0, 600, User);
        this.listens = ['READY', 'PRESENCE_UPDATE'];
    }
    notify(ev, data) {
        switch (ev) {
        case 'READY':
            for (const user of data.users)
                this.set(user.id, user);
            break;
        case 'PRESENCE_UPDATE':
            const user = this.get(data.user.id);
        }
    }
    async getUser(id, forceGet) {
        if (!id) return;
        if (!this.has(id) || forceGet) {
            const user = await this.client.fromApi(`GET /users/${id}`)
                .catch(err => {
                    console.error(err);
                    return {
                        id,
                        username: 'invalid_user',
                        global_name: 'invalid_user',
                        display_name: 'Invalid User',
                        system: true,
                        bio: err.message + ' (see console for full)'
                    }
                });
            this.set(id, user);
        }
        const user = this.get(id);
        return {
            ...user,
            username: user.display_name ?? user.global_name ?? user.username,
            text_id: (user.display_name || user.global_name)
                ? user.username
                : user.username + '#' + user.discriminator,
        }
    }
}