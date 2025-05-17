import { ActivityType } from "../../../src/api/type-enums";
import { EventSource } from "../../../src/api/event-source";
import { v6 as uuid } from 'uuid';
import { stringifyError } from "../../../src/api";
import open from "open";

/** @implements {IRPCApi} */
export default class RPCManagerV1 extends EventSource {
    /** @type {string} */
    clientId = null;
    /** @type {string} */
    #token = null;
    /** @type {{ [key: string]: { [key: string]: boolean } | boolean }} */
    subscriptions = {
        GUILD_STATUS:            {},    // [guild_id] sent when a subscribed server's state changes
        GUILD_CREATE:            false, // sent when a guild is created/joined on the client
        CHANNEL_CREATE:          false, // sent when a channel is created/joined on the client
        VOICE_CHANNEL_SELECT:    false, // sent when the client joins a voice channel
        VOICE_STATE_CREATE:      {},    // [channel_id] sent when a user joins a subscribed voice channel
        VOICE_STATE_UPDATE:      {},    // [channel_id] sent when a user's voice state changes in a subscribed voice channel (mute, volume, etc.)
        VOICE_STATE_DELETE:      {},    // [channel_id] sent when a user parts a subscribed voice channel
        VOICE_SETTINGS_UPDATE:   false, // sent when the client's voice settings update
        VOICE_CONNECTION_STATUS: false, // sent when the client's voice connection status changes
        SPEAKING_START:          {},    // [channel_id] sent when a user in a subscribed voice channel speaks
        SPEAKING_STOP:           {},    // [channel_id] sent when a user in a subscribed voice channel stops speaking
        MESSAGE_CREATE:          {},    // [channel_id] sent when a message is created in a subscribed text channel
        MESSAGE_UPDATE:          {},    // [channel_id] sent when a message is updated in a subscribed text channel
        MESSAGE_DELETE:          {},    // [channel_id] sent when a message is deleted in a subscribed text channel
        NOTIFICATION_CREATE:     false, // sent when the client receives a notification (mention or new message in eligible channels)
        ACTIVITY_JOIN:           false, // sent when the user clicks a Rich Presence join invite in chat to join a game
        ACTIVITY_SPECTATE:       false, // sent when the user clicks a Rich Presence spectate invite in chat to spectate a game
        ACTIVITY_JOIN_REQUEST:   false, // sent when the user receives a Rich Presence Ask to Join request
    };
    /** @type {{ [key: number]: string }} */
    pids = {};
    /** @type {string[]} */
    scope = [];
    /** @type {ApiInterface} */
    client = null;
    /** @type {{ cdn_url: string, api_endpoint: string, enviroment: string }} */
    config = null;
    /** @type {object} */
    app = null;
    /** @type {string} */
    authNonce = null;
    /** @type {(code: string): void} */
    acceptAuth = null;
    /** @type {(code: string): void} */
    rejectAuth = null;
    constructor(client, clientId, config, app) {
        super();
        
        this.client = client;
        this.clientId = clientId;
        this.config = config;
        this.app = app;

        this.apiReqs = {};
    }
    fromApi(callPath, body) {
        if (this.apiReqs[callPath]) return this.apiReqs[callPath];
        const [method, path] = callPath.split(' ', 2);
        if (Date.now() < this.client.limitedApis[path]) return;
        if (Date.now() < this.client.globalLimit) return;
        delete this.client.limitedApis[path];
        this.client.globalLimit = NaN;
        const url = new URL(`https://discord.com/api/v${this.client.version}${path}`);
        console.log(method, 'at', url.toString());
        const opts = {
            method,
            headers: {
                'Authorization': this.#token,
                'Content-Type': 'application/json'
            }
        }
        if (method === 'GET' && body) {
            for (const [key, value] of Object.entries(body)) {
                if (!value) continue;
                url.searchParams.set(key, value);
            }
        } else {
            opts.body = JSON.stringify(body);
        }

        const promise = fetch(url, opts)
            .then(async req => [await req.json(), req.status === 429])
            .then(([res, isRatelimit]) => {
                delete this.apiReqs[url];
                if ('code' in res) {
                    console.log('Discord API response error:', stringifyError(body, res));
                    return Promise.reject(res);
                }
                if (res.code === 40062 || isRatelimit) {
                    res.code = 40062; // ensure we see the error as a rate limit
                    const stamp = Date.now() + (res.retry_after * 1000);
                    if (res.global) this.client.globalLimit = stamp;
                    else this.client.limitedApis[path] = stamp;
                }
                return res;
            })
            .catch(message => Promise.reject({ message }));
        this.apiReqs[url] = promise;
        return promise;
    }

    fireOut(evt, data) {
        this.emit('send', {
            cmd: 'DISPATCH',
            data,
            evt
        });
    }
    async execute({ cmd, args, evt, nonce }) {
        let res;
        switch (cmd) {
        case 'AUTHORIZE': {
            this.clientId ||= args.client_id;
            const state = uuid();
            const authURL = new URL('https://discord.com/oauth2/authorize');
            authURL.searchParams.set('client_id', this.clientId);
            authURL.searchParams.set('response_type', 'code');
            authURL.searchParams.set('redirect_uri', `${this.config.api_endpoint}/auth`);
            authURL.searchParams.set('scope', args.scope.join(' '));
            authURL.searchParams.set('state', state);
            open(authURL);
            const code = await new Promise((resolve, reject) => {
                this.authNonce = state;
                this.acceptAuth = resolve;
                this.rejectAuth = reject;
            });
            res = { code };
        }
        case 'AUTHENTICATE': {
            this.#token = args.access_token;
            const res = await this.fromApi('GET /oauth2/@me').catch(err => err);
            break;
        }
        case 'SET_ACTIVITY': {
            if (!args?.activity) args = { activity: args };
            if (!args.activity) {
                for (const id in this.pids)
                    this.client.askFor('removeActivity', this.pids[id]);
                return;
            }
            const actId = uuid();
            if (args.pid) this.pids[args.pid] = actId;
            // type whitelist
            if (![
                ActivityType.Playing, 
                ActivityType.Listening, 
                ActivityType.Watching, 
                ActivityType.Competing
            ].includes(args.activity?.type)) args.activity.type = 0;
            this.client.askFor('setActivity', {
                id: actId,
                ...args.activity,
                buttons: args.activity.buttons?.map?.(({ label }) => label),
                metadata: {
                    button_urls: args.activity.buttons?.map?.(({ url }) => url),
                },
                flags: (args.activity.flags ?? 0) | (args.activity.instance ? 1 : 0),
                name: this.app.name, 
                created_at: Date.now(),
                application_id: this.app.id
            });
            return;
        }
        }
        return {
            cmd,
            nonce,
            data: res
        }
    }
}