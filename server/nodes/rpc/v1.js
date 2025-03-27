import { RPCErrorCodes } from "../../../src/api/type-enums";
import { EventSource } from "../../../src/api/event-source";
import { v6 as uuid } from 'uuid';
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
    /** @type {ApiInterface} */
    client = null;
    /** @type {{ cdn_url: string, api_endpoint: string, enviroment: string }} */
    config = null;
    /** @type {string} */
    authNonce = null;
    /** @type {(code: string): void} */
    acceptAuth = null;
    /** @type {(code: string): void} */
    rejectAuth = null;
    constructor(client, clientId, config) {
        this.client = client;
        this.clientId = clientId;
        this.config = config;
    }

    async execute(cmd, args, evt) {
        switch (cmd) {
        case 'AUTHORIZE':
            this.clientId ||= args.client_id;
            const state = uuid();
            const authURL = new URL('https://discord.com/oauth2/authorize');
            authURL.searchParams.set('client_id', this.clientId);
            authURL.searchParams.set('response_type', 'code');
            authURL.searchParams.set('redirect_uri', `${this.config.api_endpoint}/auth`);
            authURL.searchParams.set('scope', args.scope.join(' '));
            authURL.searchParams.set('state', state);
            const code = await new Promise((resolve, reject) => {
                this.authNonce = state;
                this.acceptAuth = resolve;
                this.rejectAuth = reject;
            });
            return { code };
        case 'AUTHENTICATE':

        }
    }
}