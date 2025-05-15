import { EventSource } from "../event-source";
import { ProtoType } from "../type-enums";
import { Base64Binary } from '../../b64-binnary.js';
import { FrecencyUserSettings } from '../setting-protos/frequently-used.proto';

export class Favorites extends EventSource {
    constructor(client) {
        super();
        this.listens = [];
        this.client = client;
        this.gotFavorites = false;
        this.fetchFavorites();
    }
    async fetchFavorites() { 
        const res = await this.client.fromApi(`GET /users/@me/settings-proto/${ProtoType.FrequentlyUsed}`)
            .catch(() => {});  
        if (!res) return;
        const binnary = Base64Binary.decode(res.settings);
        this.favorites = FrecencyUserSettings.decode(binnary);
        this.gotFavorites = true;
    }       
    async getFavoriteGIFS() {
        if (!this.gotFavorites) await this.fetchFavorites();
        return Object.entries(this.favorites.favoriteGifs.gifs)
            .sort(([_, { order: a }], [__, { order: b }]) => b - a)
            .map(([link, { src, width, height, format }]) => ({ link, src, width, height, type: format }))
    }   
}