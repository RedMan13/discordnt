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
    permissions = {
        readGuilds: false,
        readMembers: false,
        whenGuildJoined: false,
        whenGuildUpdates: false,
        readChannels: false,
        readDms: false,
        whenChannelCreated: false,
        joinVoiceChannels: false,
        whenVoiceJoined: false,
        whenOthersJoinVoice: false,
        whenOthersChangeVoiceSettings: false,
        whenOthersLeaveVoice: false,
        whenVoiceSpeaks: false,
        whenVoiceStopsSpeaking: false,
        readVoiceChannels: false,
        readVoiceSettings: false,
        writeVoiceSettings: false,
        whenVoiceSettingsChanged: false,
        whenVoiceConnectionChanged: false,
        changeOthersVoiceSettings: false,
        addHardwareMetadata: false,
        writeActivityState: false,
        acceptActivityInvites: false,
        rejectActivityInvites: false,
        whenMessagesCreated: false,
        whenMessagesEdited: false,
        whenMessagesDeleted: false,
        whenNotificationFired: false,
        whenActivityJoinPressed: false,
        whenActivitySpectatePressed: false,
        whenActivityJoinRequestPressed: false
    };
    throwsBlocked = {
        DISPATCH: true,
        AUTHORIZE: true,
        AUTHENTICATE: true,
        GET_GUILD: true,
        GET_GUILDS: true,
        GET_CHANNEL: true,
        GET_CHANNELS: true,
        SUBSCRIBE: true,
        UNSUBSCRIBE: true,
        SET_USER_VOICE_SETTINGS: true,
        SELECT_VOICE_CHANNEL: true,
        GET_SELECTED_VOICE_CHANNEL: true,
        SELECT_TEXT_CHANNEL: true,
        GET_VOICE_SETTINGS: true,
        SET_VOICE_SETTINGS: true,
        SET_CERTIFIED_DEVICES: true,
        SET_ACTIVITY: true,
        SEND_ACTIVITY_JOIN_INVITE: true,
        CLOSE_ACTIVITY_REQUEST: true
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

        this.client.on('MESSAGE_CREATE', evt => {
            if (!this.subscriptions.MESSAGE_CREATE[evt.channel_id]) return;
            this.fireOut('MESSAGE_CREATE', {
                channel_id: evt.channel_id,
                message: evt
            });
        });
        this.client.on('MESSAGE_UPDATE', evt => {
            if (!this.subscriptions.MESSAGE_UPDATE[evt.channel_id]) return;
            this.fireOut('MESSAGE_CREATE', {
                channel_id: evt.channel_id,
                message: evt
            });
        });
        this.client.on('MESSAGE_DELETE', evt => {
            if (!this.subscriptions.MESSAGE_DELETE[evt.channel_id]) return;
            this.fireOut('MESSAGE_CREATE', {
                channel_id: evt.channel_id,
                message: evt
            });
        });
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
    makeError(cmd, nonce, code) {
        return {
            cmd,
            data: {
                code,
                message: 'bad'
            },
            evt: 'ERROR',
            nonce
        };
    }
    handleNoPerms(cmd, nonce) {
        if (!this.throwsBlocked[cmd]) return;
        return this.emitError(cmd, nonce, 4006);
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
            const self = await this.fromApi('GET /oauth2/@me').catch(err => err);
            if (!self.scopes.includes('rpc'))
                return this.handleNoPerms(cmd, nonce);
            for (const scope of self.scopes) {
                switch (scope) {
                case 'guilds':
                    this.permissions.readGuilds &&= true;
                    this.permissions.whenGuildJoined &&= true;
                    this.permissions.whenGuildUpdates &&= true;
                    break;
                case 'dm_channels.read': this.permissions.readDms &&= true; break;
                case 'messages.read':
                    this.permissions.whenMessagesCreated &&= true;
                    this.permissions.whenMessagesDeleted &&= true;
                    this.permissions.whenMessagesEdited &&= true;
                    this.permissions.readChannels &&= true;
                    break;
                case 'rpc.activities.write':
                    this.permissions.writeActivityState &&= true;
                    this.permissions.acceptActivityInvites &&= true;
                    this.permissions.rejectActivityInvites &&= true;
                    this.permissions.whenActivityJoinPressed &&= true;
                    this.permissions.whenActivityJoinRequestPressed &&= true;
                    this.permissions.whenActivitySpectatePressed &&= true;
                    break;
                case 'rpc.notifications.read': this.permissions.whenNotificationFired &&= true; break;
                case 'rpc.voice.read':
                    this.permissions.readVoiceSettings &&= true;
                    this.permissions.whenVoiceSettingsChanged &&= true;
                    break;
                case 'rpc.voice.write': this.permissions.writeVoiceSettings &&= true; break;
                case 'voice':
                    this.permissions.readVoiceChannels &&= true;
                    this.permissions.whenOthersChangeVoiceSettings &&= true;
                    this.permissions.whenOthersJoinVoice &&= true;
                    this.permissions.whenOthersLeaveVoice &&= true;
                    this.permissions.whenVoiceConnectionChanged &&= true;
                    this.permissions.whenVoiceJoined &&= true;
                    this.permissions.whenVoiceSettingsChanged &&= true;
                    this.permissions.whenVoiceSpeaks &&= true;
                    this.permissions.whenVoiceStopsSpeaking &&= true;
                    break;
                }
            }
            res = self;
            break;
        }
        case 'GET_GUILD':
            if (!this.permissions.readGuilds) return this.handleNoPerms(cmd, nonce);
            const guild = this.client.askFor('Guilds.get', args.guild_id);
            if (!guild) return this.makeError(cmd, nonce, 4003);
            res = {
                id: guild.id,
                name: guild.name,
                icon_url: guild.icon_url,
                members: []
            }
            break;
        case 'GET_GUILDS':
            if (!this.permissions.readGuilds) return this.handleNoPerms(cmd, nonce);
            const guilds = this.client.askFor('Guilds.values')
                .map(guild => ({ id: guild.id, name: guild.name }));
            res = { guilds };
            break;
        case 'GET_CHANNEL':
            if (!this.permissions.readChannels) return this.handleNoPerms(cmd, nonce);
            const channel = this.client.askFor('Channels.get', args.channel_id);
            if (!channel) return this.makeError(cmd, nonce, 4005);
            res = {
                id: channel.id,
                guild_id: channel.guild_id,
                name: channel.name,
                type: channel.type,
                topic: channel.topic,
                bitrate: channel.bitrate,
                user_limit: channel.user_limit || 0,
                position: channel.position,
                voice_states: [], // how???????
                messages: await this.client.fromApi(`GET /channels/${channel.id}/messages`)
            }
            break;
        case 'GET_CHANNELS':
            if (!this.permissions.readChannels) return this.handleNoPerms(cmd, nonce);
            const channels = this.client.askFor('Channels.values')
                .map(channel => ({ id: channel.id, name: channel.name, type: channel.type }));
            res = { channels };
            break;
        case 'SUBSCRIBE':
            switch (evt) {
            case 'GUILD_STATUS':
                if (!this.permissions.whenGuildUpdates) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.GUILD_STATUS[args.guild_id] = true;
                break;
            case 'GUILD_CREATE':
                if (!this.permissions.whenGuildJoined) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.GUILD_CREATE = true;
                break;
            case 'CHANNEL_CREATE':
                if (!this.permissions.whenChannelCreated) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.CHANNEL_CREATE = true;
                break;
            case 'VOICE_CHANNEL_SELECT':
                if (!this.permissions.whenVoiceJoined) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_CHANNEL_SELECT = true;
                break;
            case 'VOICE_STATE_CREATE':
                if (!this.permissions.whenOthersJoinVoice) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_CREATE[args.channel_id] = true;
                break;
            case 'VOICE_STATE_UPDATE':
                if (!this.permissions.whenOthersChangeVoiceSettings) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_UPDATE[args.channel_id] = true;
                break;
            case 'VOICE_STATE_DELETE':
                if (!this.permissions.whenOthersLeaveVoice) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_DELETE[args.channel_id] = true;
                break;
            case 'VOICE_SETTINGS_UPDATE':
                if (!this.permissions.whenVoiceSettingsChanged) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_SETTINGS_UPDATE = true;
                break;
            case 'VOICE_CONNECTION_STATUS':
                if (!this.permissions.whenVoiceConnectionChanged) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_CONNECTION_STATUS = true;
                break;
            case 'SPEAKING_START':
                if (!this.permissions.whenVoiceSpeaks) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.SPEAKING_START[args.channel_id] = true;
                break;
            case 'SPEAKING_STOP':
                if (!this.permissions.whenVoiceStopsSpeaking) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.SPEAKING_STOP[args.channel_id] = true;
                break;
            case 'MESSAGE_CREATE':
                if (!this.permissions.whenMessagesCreated) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_CREATE[args.channel_id] = true;
                break;
            case 'MESSAGE_UPDATE':
                if (!this.permissions.whenMessagesEdited) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_UPDATE[args.channel_id] = true;
                break;
            case 'MESSAGE_DELETE':
                if (!this.permissions.whenMessagesDeleted) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_DELETE[args.channel_id] = true;
                break;
            case 'NOTIFICATION_CREATE':
                if (!this.permissions.whenNotificationFired) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.NOTIFICATION_CREATE = true;
                break;
            case 'ACTIVITY_JOIN':
                if (!this.permissions.whenActivityJoinPressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_JOIN = true;
                break;
            case 'ACTIVITY_SPECTATE':
                if (!this.permissions.whenActivitySpectatePressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_SPECTATE = true;
                break;
            case 'ACTIVITY_JOIN_REQUEST':
                if (!this.permissions.whenActivityJoinRequestPressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_JOIN_REQUEST = true;
                break;
            }
            res = { evt };
            break;
        case 'UNSUBSCRIBE':
            switch (evt) {
            case 'GUILD_STATUS':
                if (!this.permissions.whenGuildUpdates) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.GUILD_STATUS[args.guild_id] = false;
                break;
            case 'GUILD_CREATE':
                if (!this.permissions.whenGuildJoined) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.GUILD_CREATE = false;
                break;
            case 'CHANNEL_CREATE':
                if (!this.permissions.whenChannelCreated) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.CHANNEL_CREATE = false;
                break;
            case 'VOICE_CHANNEL_SELECT':
                if (!this.permissions.whenVoiceJoined) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_CHANNEL_SELECT = false;
                break;
            case 'VOICE_STATE_CREATE':
                if (!this.permissions.whenOthersJoinVoice) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_CREATE[args.channel_id] = false;
                break;
            case 'VOICE_STATE_UPDATE':
                if (!this.permissions.whenOthersChangeVoiceSettings) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_UPDATE[args.channel_id] = false;
                break;
            case 'VOICE_STATE_DELETE':
                if (!this.permissions.whenOthersLeaveVoice) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_STATE_DELETE[args.channel_id] = false;
                break;
            case 'VOICE_SETTINGS_UPDATE':
                if (!this.permissions.whenVoiceSettingsChanged) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_SETTINGS_UPDATE = false;
                break;
            case 'VOICE_CONNECTION_STATUS':
                if (!this.permissions.whenVoiceConnectionChanged) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.VOICE_CONNECTION_STATUS = false;
                break;
            case 'SPEAKING_START':
                if (!this.permissions.whenVoiceSpeaks) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.SPEAKING_START[args.channel_id] = false;
                break;
            case 'SPEAKING_STOP':
                if (!this.permissions.whenVoiceStopsSpeaking) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.SPEAKING_STOP[args.channel_id] = false;
                break;
            case 'MESSAGE_CREATE':
                if (!this.permissions.whenMessagesCreated) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_CREATE[args.channel_id] = false;
                break;
            case 'MESSAGE_UPDATE':
                if (!this.permissions.whenMessagesEdited) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_UPDATE[args.channel_id] = false;
                break;
            case 'MESSAGE_DELETE':
                if (!this.permissions.whenMessagesDeleted) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.MESSAGE_DELETE[args.channel_id] = false;
                break;
            case 'NOTIFICATION_CREATE':
                if (!this.permissions.whenNotificationFired) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.NOTIFICATION_CREATE = false;
                break;
            case 'ACTIVITY_JOIN':
                if (!this.permissions.whenActivityJoinPressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_JOIN = false;
                break;
            case 'ACTIVITY_SPECTATE':
                if (!this.permissions.whenActivitySpectatePressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_SPECTATE = false;
                break;
            case 'ACTIVITY_JOIN_REQUEST':
                if (!this.permissions.whenActivityJoinRequestPressed) return this.handleNoPerms(cmd, nonce);
                this.subscriptions.ACTIVITY_JOIN_REQUEST = false;
                break;
            }
            res = { evt };
            break;
        case 'SET_USER_VOICE_SETTINGS':
            if (!this.permissions.writeVoiceSettings) return this.handleNoPerms(cmd, nonce);
            break;
        case 'SELECT_VOICE_CHANNEL':
            if (!this.permissions.joinVoiceChannels) return this.handleNoPerms(cmd, nonce);
            break;
        case 'GET_SELECTED_VOICE_CHANNEL':
            if (!this.permissions.readChannels) return this.handleNoPerms(cmd, nonce);
            break;
        case 'SELECT_TEXT_CHANNEL':
            if (!this.permissions.readChannels) return this.handleNoPerms(cmd, nonce);
            break;
        case 'GET_VOICE_SETTINGS':
            if (!this.permissions.readVoiceSettings) return this.handleNoPerms(cmd, nonce);
            break;
        case 'SET_VOICE_SETTINGS':
            if (!this.permissions.writeVoiceSettings) return this.handleNoPerms(cmd, nonce);
            break;
        case 'SET_CERTIFIED_DEVICES':
            break;
        case 'SET_ACTIVITY': {
            if (!this.permissions.writeActivityState) return this.handleNoPerms(cmd, nonce);
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
        case 'SEND_ACTIVITY_JOIN_INVITE':
            if (!this.permissions.acceptActivityInvites) return this.handleNoPerms(cmd, nonce);
            break;
        case 'CLOSE_ACTIVITY_REQUEST':
            if (!this.permissions.rejectActivityInvites) return this.handleNoPerms(cmd, nonce);
            break;
        }
        return {
            cmd,
            nonce,
            data: res
        }
    }
}