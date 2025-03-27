// type descriptors
// just makes all of these have detectable names instead of just Object and Array
export class Enum {
    #string = '[ recursive ]';
    constructor(enumerator) {
        if (Array.isArray(enumerator))
            this.#string = enumerator.join(', ')
        else this.#string = 'enum {\n    ' + Object.entries(enumerator)
            .map(([key, val]) => `${key} = ${val}`)
            .join('\n    ') + '\n}';
        if (Array.isArray(enumerator)) {
            for (const ent of enumerator) 
                this[ent] = ent;
            return;
        }
        for (const [key, value] of Object.entries(enumerator)) {
            this[key] = value;
            this[value] = key;
        }
    }
    toString() {
        return this.#string;
    }
}
export class Flags extends Array {
    constructor(names) {
        super(...names);
    }
    toString() {
        return `BitField(${this.join(', ')})`;
    }
}
export class Dict {
    constructor(keyType, valueType) {
        this.types = [keyType, valueType];
    }
    toString() {
        return `{ [key: ${this.types[0].toString()}]: ${this.types[1]} }`;
    }
}
export class Any { toString() { return 'Any' } }
export const string = Symbol('string');
export const number = Symbol('number');
export const boolean = Symbol('boolean');
// why the FUCK is null an object
function typeOf(val) {
    if (val === null) return typeof undefined;
    return typeof val;
}
function toString(val, indent = 0, done) {
    if (!done) done = [];
    const b = '    '.repeat(indent);
    const i = '    '.repeat(++indent);
    switch (typeof val) {
    case 'string': return `"${val.replaceAll('"', '\\"')}"`;
    case 'number': break;
    case 'boolean': break;
    case 'undefined': return 'null';
    case 'symbol':
        switch (val) {
        case string: return 'string';
        case number: return 'number';
        case boolean: return 'boolean';
        }
        break;
    case 'object':
        if (val instanceof Enum ||
            val instanceof Flags ||
            val instanceof Dict ||
            val instanceof Any ||
            val === null
        ) break;
        if (done.find(v => v === val)) return '[ recursive ]';
        done.push(val);
        if (Array.isArray(val))
            return '[\n' +
                    val.map(val => i + toString(val, indent, done)).join(',\n') +
                '\n' + b + ']';
        return '{\n' + 
                Object.entries(val)
                    .map(([key, val]) => `${i}"${key}": ${toString(val, indent, done)}`)
                    .join(',\n') +
            '\n' + b + '}';
    }
    return `${val}`;
}
export function checkType(object, compare, silence, keypath = '', checked) {
    checked ??= {};
    if (typeOf(checked[keypath]) !== 'undefined') return checked[keypath];
    checked[keypath] = false;
    let good = true;
    let handled = false;
    const err = (expect, got) => {
        good = false;
        if (silence) return;
        console.log(`Bad Key ${keypath}; expected ${toString(expect)} but got ${toString(got)}`)
    }
    if (typeOf(compare) === 'symbol' || compare === null || compare === undefined) {
        switch (compare) {
        case string: 
            if (typeOf(object) !== 'string')
                err('string', object);
            break;
        case number:
            if (typeOf(object) !== 'number')
                err('number', object);
            break;
        case boolean:
            if (typeOf(object) !== 'boolean')
                err('boolean', object);
            break;
        case null:
        case undefined:
            if (object !== null && object !== undefined)
                err('null', object);
            break;
        }
        handled = true;
    }
    if (compare instanceof Any && !handled) {
        handled = true;
    }
    if (compare instanceof Dict && !handled) {
        const [kType, vType] = compare.types;
        const isGood = Object.entries(object)
            .reduce((cur, [key, value]) => 
                checkType(key, kType, silence, `${keypath}['${key}'](key)`, checked) &&
                checkType(value, vType, silence, `${keypath}['${key}'](value)`, checked) && cur, true)
        good = isGood;
        handled = true;
    }
    if (compare instanceof Flags && !handled) {
        const isGood = typeOf(object) === 'number';
        if (!isGood)
            err('integer bitfield', object);
        handled = true;
    }
    if (compare instanceof Enum && !handled) {
        const isGood = typeOf(compare[object]) !== 'undefined';
        if (!isGood)
            err(`oneof ${compare}`, object);
        handled = true;
    }
    if (Array.isArray(compare) && !handled) {
        if (compare[0] === '...') {
            if (!Array.isArray(object))
                err('array', object);
            const [_, type, min, max] = compare;
            if (compare.length > 2) {
                if (object.length < min || object.length > max)
                    err(`[${min}, ${max}]`, object);
                const isGood = object
                    .reduce((cur, ent, idx) => checkType(ent, type, silence, `${keypath}[${idx}]`, checked) && cur, true);
                checked[keypath] = isGood;
                return isGood;
            }
        } else { 
            const isGood = compare
                .some((type, idx) => checkType(object, type, true, `${keypath}(var ${idx})`, checked));
            if (!isGood)
                err(`oneof ${toString(compare)}`, object);
        }
        handled = true;
    }
    if (compare instanceof Object && !handled) {
        if (typeOf(object) !== 'object')
            err(compare, object);
        else {
            const isGood = Object.entries(object)
                .reduce((cur, [key, value]) => checkType(value, compare[key], silence, `${keypath}.${key}`, checked) && cur, true);
            good = isGood;
        }
        handled = true;
    }
    checked[keypath] = good;
    return good;
}

export const HasTypes = new Enum({
    'link': 'link',
    'embed': 'embed',
    'poll': 'poll',
    'file': 'file',
    'video': 'video',
    'image': 'image',
    'sound': 'sound',
    'sticker': 'sticker',
    'forward': 'snapshot'
});
export const RPCErrorCodes = new Enum({
    UnknownError:                    1000, // An unknown error occurred.
    InvalidPayload:                  4000, // You sent an invalid payload.
    InvalidCommand:                  4002, // Invalid command name specified.
    InvalidGuild:                    4003, // Invalid guild ID specified.
    InvalidEvent:                    4004, // Invalid event name specified.
    InvalidChannel:                  4005, // Invalid channel ID specified.
    InvalidPermissions:              4006, // You lack permissions to access the given resource.
    InvalidClientID:                 4007, // An invalid OAuth2 application ID was used to authorize or authenticate with.
    InvalidOrigin:                   4008, // An invalid OAuth2 application origin was used to authorize or authenticate with.
    InvalidToken:                    4009, // An invalid OAuth2 token was used to authorize or authenticate with.
    InvalidUser:                     4010, // The specified user ID was invalid.
    OAuth2Error:                     5000, // A standard OAuth2 error occurred; check the data object for the OAuth2 error details.
    SelectChannelTimedOut:           5001, // An asynchronous SELECT_TEXT_CHANNEL/SELECT_VOICE_CHANNEL command timed out.
    GetGuildTimedOut:                5002, // An asynchronous GET_GUILD command timed out.
    SelectVoiceForceRequired:        5003, // You tried to join a user to a voice channel but the user was already in one.
    CaptureShortcutAlreadyListening: 5004, // You tried to capture more than one shortcut key at once.
});
export const RPCCloseCodes = new Enum({
    InvalidClientID: 4000, // You connected to the RPC server with an invalid client ID.
    InvalidOrigin:   4001, // You connected to the RPC server with an invalid origin.
    RateLimited:     4002, // You are being rate limited.
    TokenRevoked:    4003, // The OAuth2 token associated with a connection was revoked, get a new one!
    InvalidVersion:  4004, // The RPC Server version specified in the connection string was not valid.
    InvalidEncoding: 4005, // The encoding specified in the connection string was not valid.
});
export const ChannelType = new Enum({
    GUILD_TEXT:          0,  // a text channel within a server
    DM:                  1,  // a direct message between users
    GUILD_VOICE:         2,  // a voice channel within a server
    GROUP_DM:            3,  // a direct message between multiple users
    GUILD_CATEGORY:      4,  // an organizational category that contains up to 50 channels
    GUILD_ANNOUNCEMENT:  5,  // a channel that users can follow and crosspost into their own server (formerly news channels)
    ANNOUNCEMENT_THREAD: 10, // a temporary sub-channel within a GUILD_ANNOUNCEMENT channel
    PUBLIC_THREAD:       11, // a temporary sub-channel within a GUILD_TEXT or GUILD_FORUM channel
    PRIVATE_THREAD:      12, // a temporary sub-channel within a GUILD_TEXT channel that is only viewable by those invited and those with the MANAGE_THREADS permission
    GUILD_STAGE_VOICE:   13, // a voice channel for hosting events with an audience
    GUILD_DIRECTORY:     14, // the channel in a hub containing the listed servers
    GUILD_FORUM:         15, // Channel that can only contain threads
    GUILD_MEDIA:         16  // Channel that can only contain threads, similar to GUILD_FORUM channels
});
export const GatewayOpcode = new Enum({
    Dispatch:                0,  // [Receive] An event was dispatched.
    Heartbeat:               1,  // [Send/Receive] Fired periodically by the client to keep the connection alive.
    Identify:                2,  // [Send]    Starts a new session during the initial handshake.
    PresenceUpdate:          3,  // [Send]    Update the client's presence.
    VoiceStateUpdate:        4,  // [Send]    Used to join/leave or move between voice channels.
    Resume:                  6,  // [Send]    Resume a previous session that was disconnected.
    Reconnect:               7,  // [Receive] You should attempt to reconnect and resume immediately.
    RequestGuildMembers:     8,  // [Send]    Request information about offline guild members in a large guild.
    InvalidSession:          9,  // [Receive] The session has been invalidated. You should reconnect and identify/resume accordingly.
    Hello:                   10, // [Receive] Sent immediately after connecting, contains the heartbeat_interval to use.
    HeartbeatACK:            11, // [Receive] Sent in response to receiving a heartbeat to acknowledge that it has been received.
    RequestSoundboardSounds: 31, // [Send]    Request information about soundboard sounds in a set of guilds.
});
export const UserFlags = new Flags([
    'STAFF',                    // Discord Employee
    'PARTNER',                  // Partnered Server Owner
    'HYPESQUAD',                // HypeSquad Events Member
    'BUG_HUNTER_LEVEL_1',       // Bug Hunter Level 1
    'HYPESQUAD_ONLINE_HOUSE_1', // House Bravery Member
    'HYPESQUAD_ONLINE_HOUSE_2', // House Brilliance Member
    'HYPESQUAD_ONLINE_HOUSE_3', // House Balance Member
    'PREMIUM_EARLY_SUPPORTER',  // Early Nitro Supporter
    'TEAM_PSEUDO_USER',         // User is a team
    'BUG_HUNTER_LEVEL_2',       // Bug Hunter Level 2
    'VERIFIED_BOT',             // Verified Bot
    'VERIFIED_DEVELOPER',       // Early Verified Bot Developer
    'CERTIFIED_MODERATOR',      // Moderator Programs Alumni
    'BOT_HTTP_INTERACTIONS',    // Bot uses only HTTP interactions and is shown in the online member list
    'ACTIVE_DEVELOPER',         // User is an Active Developer
]);
const MessageType = new Enum({
    DEFAULT:                                      0,
    RECIPIENT_ADD:                                1,
    RECIPIENT_REMOVE:                             2,
    CALL:                                         3,
    CHANNEL_NAME_CHANGE:                          4,
    CHANNEL_ICON_CHANGE:                          5,
    CHANNEL_PINNED_MESSAGE:                       6,
    USER_JOIN:                                    7,
    GUILD_BOOST:                                  8,
    GUILD_BOOST_TIER_1:                           9,
    GUILD_BOOST_TIER_2:                           10,
    GUILD_BOOST_TIER_3:                           11,
    CHANNEL_FOLLOW_ADD:                           12,
    GUILD_DISCOVERY_DISQUALIFIED:                 14,
    GUILD_DISCOVERY_REQUALIFIED:                  15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING: 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING:   17,
    THREAD_CREATED:                               18,
    REPLY:                                        19,
    CHAT_INPUT_COMMAND:                           20,
    THREAD_STARTER_MESSAGE:                       21,
    GUILD_INVITE_REMINDER:                        22,
    CONTEXT_MENU_COMMAND:                         23,
    AUTO_MODERATION_ACTION:                       24,
    ROLE_SUBSCRIPTION_PURCHASE:                   25,
    INTERACTION_PREMIUM_UPSELL:                   26,
    STAGE_START:                                  27,
    STAGE_END:                                    28,
    STAGE_SPEAKER:                                29,
    STAGE_TOPIC:                                  31,
    GUILD_APPLICATION_PREMIUM_SUBSCRIPTION:       32,
    GUILD_INCIDENT_ALERT_MODE_ENABLED:            36,
    GUILD_INCIDENT_ALERT_MODE_DISABLED:           37,
    GUILD_INCIDENT_REPORT_RAID:                   38,
    GUILD_INCIDENT_REPORT_FALSE_ALARM:            39,
    PURCHASE_NOTIFICATION:                        44,
    POLL_RESULT:                                  46
});
const MessageActivityType = new Enum({
    JOIN:         1,
    SPECTATE:     2,
    LISTEN:       3,
    JOIN_REQUEST: 5,
});
export const PremiumType = new Enum({
    None:         0,
    NitroClassic: 1,
    Nitro:        2,
    NitroBasic:   3,
});
export const Locale = new Enum({
    'id': 'Indonesian',               // Bahasa Indonesia
    'da': 'Danish',                   // Dansk
    'de': 'German',                   // Deutsch
    'en-GB': 'English, UK',           // English, UK
    'en-US': 'English, US',           // English, US
    'es-ES': 'Spanish',               // Español
    'es-419': 'Spanish, LATAM',       // Español, LATAM
    'fr': 'French',                   // Français
    'hr': 'Croatian',                 // Hrvatski
    'it': 'Italian',                  // Italiano
    'lt': 'Lithuanian',               // Lietuviškai
    'hu': 'Hungarian',                // Magyar
    'nl': 'Dutch',                    // Nederlands
    'no': 'Norwegian',                // Norsk
    'pl': 'Polish',                   // Polski
    'pt-BR': 'Portuguese, Brazilian', // Português do Brasil
    'ro': 'Romanian, Romania',        // Română
    'fi': 'Finnish',                  // Suomi
    'sv-SE': 'Swedish',               // Svenska
    'vi': 'Vietnamese',               // Tiếng Việt
    'tr': 'Turkish',                  // Türkçe
    'cs': 'Czech',                    // Čeština
    'el': 'Greek',                    // Ελληνικά
    'bg': 'Bulgarian',                // български
    'ru': 'Russian',                  // Pусский
    'uk': 'Ukrainian',                // Українська
    'hi': 'Hindi',                    // हिन्दी
    'th': 'Thai',                     // ไทย
    'zh-CN': 'Chinese, China',        // 中文
    'ja': 'Japanese',                 // 日本語
    'zh-TW': 'Chinese, Taiwan',       // 繁體中文
    'ko': 'Korean',                   // 한국어"
})

export const Emoji = {
    id: [string, null],
    name: string,
    roles: [['...', string], null],
    user: [null, null],
    require_colons: [boolean, null],
    managed: [boolean, null],
    animated: [boolean, null],
    available: [boolean, null]
}
export const ComponentType = new Enum({
    ActionRow: 1, // Container for other components
    Button: 2, // Button object
    StringSelect: 3, // Select menu for picking from defined text options
    TextInput: 4, // Text input object
    UserSelect: 5, // Select menu for users
    RoleSelect: 6, // Select menu for roles
    MentionableSelect: 7, // Select menu for mentionables (users and roles)
    ChannelSelect: 8, // Select menu for channels
});
export const Components = [{
    type: ComponentType.Button,
    style: new Enum({ // A button style
        Primary: 1,   // blurple
        Secondary: 2, // grey
        Success: 3,   // green
        Danger: 4,    // red
        Link: 5,      // grey, navigates to a URL
        Premium: 6,   // blurple
    }),
    label: [string, null],     // Text that appears on the button; max 80 characters
    emoji: [Emoji, null],      // name, id, and animated
    custom_id: [string, null], // Developer-defined identifier for the button; max 100 characters
    sku_id: [string, null],    // Identifier for a purchasable SKU, only available when using premium-style buttons
    url: [string. null],       // URL for link-style buttons
    disabled: [boolean, null], // Whether the button is disabled (defaults to false)
}, {
    type: ComponentType.StringSelect,
    custom_id: string, // ID for the select menu; max 100 characters
    placeholder: [string, null], // Placeholder text if nothing is selected; max 150 characters
    options: ['...', { // Specified choices in a select menu (only required and available for string selects (type 3); max 25
        label: string,               // User-facing name of the option; max 100 characters
        value: string,               // Dev-defined value of the option; max 100 characters
        description: [string, null], // Additional description of the option; max 100 characters
        emoji: [Emoji, null],        // id, name, and animated
        default: [boolean, null] ,   // Will show this option as selected by default
    }, 0, 25],
}, {
    type: [                              // Type of select menu component (text: 3, user: 5, role: 6, mentionable: 7, channels: 8)
        ComponentType.UserSelect,
        ComponentType.RoleSelect, 
        ComponentType.MentionableSelect, 
        ComponentType.ChannelSelect
    ],
    custom_id: string,                   // ID for the select menu; max 100 characters
    placeholder: [string, null],         // Placeholder text if nothing is selected; max 150 characters
    default_values: [['...', {           // List of default values for auto-populated select menu components; number of default values must be in the range defined by min_values and max_values
        id: string,      // ID of a user, role, or channel
        type: new Enum([ // Type of value that id represents. Either "user", "role", or "channel"
            'user',
            'role',
            'channel'
        ]),
    }], null],
    channel_types: ['...', ChannelType], // List of channel types to include in the channel select component (type 8)
    min_values: [number, null],          // Minimum number of items that must be chosen (defaults to 1); min 0, max 25
    max_values: [number, null],          // Maximum number of items that can be chosen (defaults to 1); max 25
    disabled: [boolean, null],           // Whether select menu is disabled (defaults to false)
}, {
    type: ComponentType.TextInput,
    custom_id: string,           // Developer-defined identifier for the input; max 100 characters
    style: new Enum({            // The Text Input Style
        Short:     1, // Single-line input
        Paragraph: 2, // Multi-line input
    }),
    label: string,               // Label for this component; max 45 characters
    min_length: [number, null],  // Minimum input length for a text input; min 0, max 4000
    max_length: [number, null],  // Maximum input length for a text input; min 1, max 4000
    required: [boolean, null],   // Whether this component is required to be filled (defaults to true)
    value: [string, null],       // Pre-filled value for this component; max 4000 characters
    placeholder: [string, null], // Custom placeholder text if the input is empty; max 100 characters
}];
Components.unshift({
    type: ComponentType.ActionRow,
    id: [number, null],
    components: ['...', Components]
});
export const GamingGuildBadge = {
    badge: [string, null],             // the badge icon hash of this gg
    identity_enabled: boolean,         // if this user has enabled the display of this gg's badge
    identity_guild_id: [string, null], // the id of the guild this gg is in
    tag: [string, null]                // the four-letter tagname of the gg
}
export const User = {
    id: string,                   // the user's id
    bio: [string, null],          // the user's bio
    username: string,             // the user's username, not unique across the platform
    discriminator: string,        // the user's Discord-tag
    global_name: [string, null],  // the user's display name, if it is set. For bots, this is the application name
    display_name: [string, null], // the user's display name, if it is set. For bots, this is the application name
    avatar: [string, null],       // the user's avatar hash
    bot: [boolean, null],         // whether the user belongs to an OAuth2 application
    system: [boolean, null],      // whether the user is an Official Discord System user (part of the urgent message system)
    mfa_enabled: [boolean, null], // whether the user has two factor enabled on their account
    banner: [string, null],       // the user's banner hash
    accent_color: [number, null], // the user's banner color encoded as an integer representation of hexadecimal color code
    banner_color: [string, null], // the hex color code for the users banner (none-nitro)
    locale: [Locale, null],       // the user's chosen language option
    verified: [boolean, null],    // whether the email on this account has been verified
    email: [string, null],        // the user's email
    flags: [number, null],        // the flags on a user's account
    premium_type: [PremiumType, null], // the type of Nitro subscription on a user's account
    public_flags: [number, null], // the public flags on a user's account
    avatar_decoration_data: [{    // data for the user's avatar decoration
        asset: string,             // the avatar decoration hash
        sku_id: string,            // id of the avatar decoration's SKU
        expires_at: [number, null] // idfk
    }, null],
    primary_guild: [GamingGuildBadge, null], // the Gaming Guid this user is from
    clan: [GamingGuildBadge, null], // sudonym of primary_guild
    presence: [{                  // tacked-on internally, the presence of this user
        since: [number, null],
        activities: ['...', {
            name: string,                            // Activity's name
            type: new Enum({                         // Activity type
                Playing:   0, // Playing {name}      "Playing Rocket League"
                Streaming: 1, // Streaming {details} "Streaming Rocket League"
                Listening: 2, // Listening to {name} "Listening to Spotify"
                Watching:  3, // Watching {name}	 "Watching YouTube Together"
                Custom:    4, // {emoji} {state}	 ":smiley: I am cool"
                Competing: 5, // Competing in {name} "Competing in Arena World Champions"
            }),
            url: [string, null],                     // Stream URL, is validated when type is 1
            created_at: number,                      // Unix timestamp (in milliseconds) of when the activity was added to the user's session
            timestamps: [{                           // Unix timestamps for start and/or end of the game
                start: [number, null],
                end: [number, null],
            }, null],
            application_id: [string, null],          // Application ID for the game
            details: [string, null],                 // What the player is currently doing
            state: [string, null],                   // User's current party status, or text used for a custom status
            emoji: [Emoji, null],                    // Emoji used for a custom status
            party: [{                                // Information for the current party of the player
                id: [string, null],
                size: [{
                    0: number, // min players
                    1: number, // max players
                }, null],
            }, null],
            assets: [{                               // Images for the presence and their hover texts
                large_image: [string, null], // See Activity Asset Image
                large_text: [string, null],  // Text displayed when hovering over the large image of the activity
                small_image: [string, null], // See Activity Asset Image
                small_text: [string, null],  // Text displayed when hovering over the small image of the activity
            }, null],
            secrets: [{                              // Secrets for Rich Presence joining and spectating
                join: [string, null],     // Secret for joining a party
                spectate: [string, null], // Secret for spectating a game
                match: [string, null],    // Secret for a specific instanced match
            }, null],
            instance: [boolean, null],               // Whether or not the activity is an instanced game session
            flags: [new Flags([                      // Activity flags ORd together, describes what the payload includes
                'INSTANCE',
                'JOIN',
                'SPECTATE',
                'JOIN_REQUEST',
                'SYNC',
                'PLAY',
                'PARTY_PRIVACY_FRIENDS',
                'PARTY_PRIVACY_VOICE_CHANNEL',
                'EMBEDDED',
            ]), null],
            buttons: [['...', Components[1]], null], // Custom buttons shown in the Rich Presence (max 2)
        }],
        status: new Enum([
            'online',    // Online
            'dnd',       // Do Not Disturb
            'idle',      // AFK
            'invisible', // Invisible and shown as offline
            'offline',   // Offline
        ]),
        afk: boolean
    }, null]
}
Emoji.user[0] = User;
export const Role = {
    id: string,                    // role id
    name: string,                  // role name
    color: number,                 // integer representation of hexadecimal color code
    hoist: boolean,                // if this role is pinned in the user listing
    icon: [string, null],          // role icon hash
    unicode_emoji: [string, null], // role unicode emoji
    position: number,              // position of this role (roles with the same position are sorted by id)
    permissions: string,           // permission bit set
    managed: boolean,              // whether this role is managed by an integration
    mentionable: boolean,          // whether this role is mentionable
    tags: [{                       // the tags this role has
        bot_id: [string, null],                  // the id of the bot this role belongs to
        integration_id: [string, null],          // the id of the integration this role belongs to
        premium_subscriber: null,                // whether this is the guild's Booster role
        subscription_listing_id: [string, null], // the id of this role's subscription sku and listing
        available_for_purchase: null,            // whether this role is available for purchase
        guild_connections: null                  // whether this role is a guild's linked role
    }, null],
    flags: new Flags([             // role flags combined as a bitfield
        'IN_PROMPT' // role can be selected by members in an onboarding prompt
    ])
}
export const Sticker = {
    id: string,                  // id of the sticker
    pack_id: [string, null],     // for standard stickers, id of the pack the sticker is from
    name: string,                // name of the sticker
    description: [string, null], // description of the sticker
    tags: string,                // autocomplete/suggestion tags for the sticker (max 200 characters)
    type: new Enum({             // type of sticker
        STANDARD: 1, // an official sticker in a pack
        GUILD:    2  // a sticker uploaded to a guild for the guild's members
    }),
    format_type: new Enum({      // type of sticker format
        PNG:    1,
        APNG:   2,
        LOTTIE: 3,
        GIF:    4
    }),
    available: [boolean, null],  // whether this guild sticker can be used, may be false due to loss of Server Boosts
    guild_id: [string, null],    // id of the guild that owns this sticker
    user: [User, null],          // the user that uploaded the guild sticker
    sort_value: [number, null]   // the standard sticker's sort order within its pack
}
export const Member = {
    user: [User, null],                           // the user this guild member represents
    guild_id: [string, null],
    user_id: [string, null],
    nick: [string, null],                         // this user's guild nickname
    avatar: [string, null],                       // the member's guild avatar hash
    banner: [string, null],                       // the member's guild banner hash
    roles: ['...', string],                       // array of role object ids
    joined_at: string,                            // when the user joined the guild
    premium_since: [string, null],                // when the user started boosting the guild
    deaf: boolean,                                // whether the user is deafened in voice channels
    mute: boolean,                                // whether the user is muted in voice channels
    flags: new Flags([
        'DID_REJOIN', // Member has left and rejoined the guild
        'COMPLETED_ONBOARDING', // Member has completed onboarding
        'BYPASSES_VERIFICATION', // Member is exempt from guild verification requirements
        'STARTED_ONBOARDING', // Member has started onboarding
        'IS_GUEST', // Member is a guest and can only access the voice channel they were invited to
        'STARTED_HOME_ACTIONS', // Member has started Server Guide new member actions
        'COMPLETED_HOME_ACTIONS', // Member has completed Server Guide new member actions
        'AUTOMOD_QUARANTINED_USERNAME',// Member's username, display name, or nickname is blocked by AutoMod
        null,
        'DM_SETTINGS_UPSELL_ACKNOWLEDGED', // Member has dismissed the DM settings upsell
    ]),                           // guild member flags represented as a bit set, defaults to 0
    pending: [boolean, null],                     // whether the user has not yet passed the guild's Membership Screening requirements
    permissions: [string, null],                  // total permissions of the member in the channel, including overwrites, returned when in the interaction object
    communication_disabled_until: [string, null], // when the user's timeout will expire and the user will be able to communicate in the guild again, null or a time in the past if the user is not timed out
    unusual_dm_activity_until: [string, null],    // skee BEE dee
    avatar_decoration_data: {                     // data for the member's guild avatar decoration
        asset: string, // the avatar decoration hash
        sku_id: string // id of the avatar decoration's SKU
    }
}
export const GuildNotifications = new Enum({
    ALL_MESSAGES:  0, // members will receive notifications for all messages by default
    ONLY_MENTIONS: 1, // members will receive notifications only for messages that @mention them by default
    NOTHING:       2,
});
export const ChannelNotifications = new Enum({
    PARENT_VALUE:  0,
    ALL_MESSAGES:  1, // members will receive notifications for all messages by default
    ONLY_MENTIONS: 2, // members will receive notifications only for messages that @mention them by default
    NOTHING:       3,
})
export const Channel = {
    id: string, // the id of this channel
    type: ChannelType, // the type of channel
    version: [number, null],
    template: [string, null],
    icon_emoji: [Emoji, null],
    muted: [boolean, null],
    message_notifications: [ChannelNotifications, null],
    mute_config: [{
        selected_time_window: [number, null],
        end_time: [string, null],
    }, null],
    collapsed: [boolean, null],
    member_ids: [['...', string], null],
    member_ids_preview: [['...', string], null],
    guild_id: [string, null], // the id of the guild (may be missing for some channel objects received over gateway guild dispatches)
    position: [number, null], // sorting position of the channel (channels with the same position are sorted by id)
    permission_overwrites: [['...', { // explicit permission overwrites for members and roles
        id: string,      // role or user id
        type: new Enum({ // either 0 (role) or 1 (member)
            Role:   0,
            Member: 1,
        }),
        allow: string,   // permission bit set
        deny: string,    // permission bit set
    }], null],
    newly_created: [boolean, null],
    name: [string, null], // the name of the channel (1-100 characters)
    topic: [string, null], // the channel topic (0-4096 characters for GUILD_FORUM and GUILD_MEDIA channels, 0-1024 characters for all others)
    nsfw: [boolean, null], // whether the channel is nsfw
    last_message_id: [string, null], // the id of the last message sent in this channel (or thread for GUILD_FORUM or GUILD_MEDIA channels) (may not point to an existing or valid message or thread)
    bitrate: [number, null], // the bitrate (in bits) of the voice channel
    user_limit: [number, null], // the user limit of the voice channel
    rate_limit_per_user: [number, null], // amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission manage_messages or manage_channel, are unaffected
    recipients: [['...', User], null], // the recipients of the DM
    icon: [string, null], // icon hash of the group DM
    owner_id: [string, null], // id of the creator of the group DM or thread
    application_id: [string, null], // application id of the group DM creator if it is bot-created
    managed: [boolean, null], // for group DM channels: whether the channel is managed by an application via the gdm.join OAuth2 scope
    parent_id: [string, null], // for guild channels: id of the parent category for a channel (each parent category can contain up to 50 channels), for threads: id of the text channel this thread was created
    last_pin_timestamp: [string, null], // when the last pinned message was pinned. This may be null in events such as GUILD_CREATE when a message is not pinned.
    rtc_region: [string, null], // voice region id for the voice channel, automatic when set to null
    theme_color: [number, null],
    voice_background_display: [{
        type: new Enum({
            unknown: 0
        }),
        resource_id: [string, null]
    }, null],
    safety_warnings: [['...', Any], null],
    recipient_ids: [['...', string], null],
    recipient_flags: [new Flags([]), null],
    is_spam: [boolean, null],
    is_message_request: [boolean, null],
    is_message_request_timestamp: [string, null],
    blocked_user_warning_dismissed: [boolean, null],
    video_quality_mode: [number, null], // the camera video quality mode of the voice channel, 1 when not present
    message_count: [number, null], // number of messages (not including the initial message or deleted messages) in a thread.
    member_count: [number, null], // an approximate count of users in a thread, stops counting at 50
    thread_metadata: [{ // thread-specific fields not needed by other channels
        archived: boolean,                // whether the thread is archived
        auto_archive_duration: number,    // the thread will stop showing in the channel list after auto_archive_duration minutes of inactivity, can be set to: 60, 1440, 4320, 10080
        archive_timestamp: string,        // timestamp when the thread's archive status was last changed, used for calculating recent activity
        locked: boolean,                  // whether the thread is locked; when a thread is locked, only users with MANAGE_THREADS can unarchive it
        invitable: [boolean, null],       // whether non-moderators can add other non-moderators to a thread; only available on private threads
        create_timestamp: [string, null], // timestamp when the thread was created; only populated for threads created after 2022-01-09
    }, null], 
    member: [{                   // thread member object for the current user, if they have joined the thread, only included on certain API endpoints
        id: [string, null],      // ID of the thread
        user_id: [string, null], // ID of the user
        join_timestamp: string,  // Time the user last joined the thread
        muted: [boolean, null],
        mute_config: null,
        flags: number,           // Any user-thread settings, currently only used for notifications
        member: [Member, null],  // Additional information about the user
    }, null],
    default_auto_archive_duration: [number, null], // default duration, copied onto newly created threads, in minutes, threads will stop showing in the channel list after the specified period of inactivity, can be set to: 60, 1440, 4320, 10080
    permissions: [string, null], // computed permissions for the invoking user in the channel, including overwrites, only included when part of the resolved data received on a slash command interaction. This does not include implicit permissions, which may need to be checked separately
    flags: [new Flags([ // channel flags combined as a bitfield
        null,
        'PINNED',                      // this thread is pinned to the top of its parent GUILD_FORUM or GUILD_MEDIA channel
        null, null,
        'REQUIRE_TAG',                 // whether a tag is required to be specified when creating a thread in a GUILD_FORUM or a GUILD_MEDIA channel. Tags are specified in the applied_tags field.
        null, null, null, null, null, null, null, null, null, null,
        'HIDE_MEDIA_DOWNLOAD_OPTIONS', // when set hides the embedded media download options. Available only for media channels
    ]), null],
    total_message_sent: [number, null], // number of messages ever sent in a thread, it's similar to message_count on message creation, but will not decrement the number when a message is deleted
    available_tags: [['...', { // the set of tags that can be used in a GUILD_FORUM or a GUILD_MEDIA channel
        id: string,                 // the id of the tag
        name: string,               // the name of the tag (0-20 characters)
        moderated: boolean,         // whether this tag can only be added to or removed from threads by a member with the MANAGE_THREADS permission
        emoji_id: [string, null],   // the id of a guild's custom emoji *
        emoji_name: [string, null], // the unicode character of the emoji *
    }], null],
    applied_tags: [['...', string], null], // the IDs of the set of tags that have been applied to a thread in a GUILD_FORUM or a GUILD_MEDIA channel
    default_reaction_emoji: [{ // the emoji to show in the add reaction button on a thread in a GUILD_FORUM or a GUILD_MEDIA channel
        emoji_id: [string, null], // the id of a guild's custom emoji
        emoji_name: [string, null], // the unicode character of the emoji
    }, null],
    status: [string, null],
    default_thread_rate_limit_per_user: [number, null], // the initial rate_limit_per_user to set on newly created threads in a channel. this field is copied to the thread at creation time and does not live update.
    default_sort_order: [number, null], // the default sort order type used to order posts in GUILD_FORUM and GUILD_MEDIA channels. Defaults to null, which indicates a preferred sort order hasn't been set by a channel admin
    default_forum_layout: [number, null], // the default forum layout view used to display posts in GUILD_FORUM channels. Defaults to 0, which indicates a layout view has not been set by a channel admin
}
export const Guild = {
    id: string,                                    // guild id
    name: string,                                  // guild name (2-100 characters, excluding trailing and leading whitespace)
    icon: [string, null],                          // icon hash
    stage_instances: [['...', Channel], null],
    properties: [null, null],
    member_count: [number, null],
    lazy: [boolean, null],
    large: [boolean, null],
    joined_at: [string, null],
    data_mode: [string, null],
    application_command_counts: new Dict(string, Any), 
    guild_scheduled_events: [Array, null],
    suppress_roles: [boolean, null],
    suppress_everyone: [boolean, null],
    notify_highlights: [number, null],
    muted: [boolean, null],
    mute_scheduled_events: [boolean, null],
    mobile_push: [boolean, null],
    message_notifications: [GuildNotifications, null],
    hide_muted_channels: [boolean, null],
    mute_config: [{
        selected_time_window: [number, null],
        end_time: [string, null],
    }, null],
    flags: [number, null],
    icon_hash: [string, null],                     // icon hash, returned when in the template object
    splash: [string, null],                        // splash hash
    discovery_splash: [string, null],              // discovery splash hash; only present for guilds with the "DISCOVERABLE" feature
    owner: [boolean, null],                        // true if the user is the owner of the guild
    owner_id: string,                              // id of owner
    permissions: [string, null],                   // total permissions for the user in the guild (excludes overwrites and implicit permissions)
    region: [string, null],                        // voice region id for the guild (deprecated)
    afk_channel_id: [string, null],                // id of afk channel
    afk_timeout: number,                           // afk timeout in seconds
    widget_enabled: [boolean, null],               // true if the server widget is enabled
    widget_channel_id: [string, null],             // the channel id that the widget will generate an invite to, or null if set to no invite
    verification_level: new Enum({                 // verification level required for the guild
        NONE:      0, // unrestricted
        LOW:       1, // must have verified email on account
        MEDIUM:    2, // must be registered on Discord for longer than 5 minutes
        HIGH:      3, // must be a member of the server for longer than 10 minutes
        VERY_HIGH: 4, // must have a verified phone number
    }),
    default_message_notifications: GuildNotifications, // default message notifications level
    explicit_content_filter: new Enum({            // explicit content filter level
        DISABLED:              0, // media content will not be scanned
        MEMBERS_WITHOUT_ROLES: 1, // media content sent by members without roles will be scanned
        ALL_MEMBERS:           2, // media content sent by all members will be scanned
    }),
    roles: ['...', Role],                          // roles in the guild
    emojis: ['...', Emoji],                        // custom guild emojis
    version: [number, null],
    features: ['...', new Enum([                   // enabled guild features
        'ANIMATED_BANNER',                           // guild has access to set an animated guild banner image
        'ANIMATED_ICON',                             // guild has access to set an animated guild icon
        'APPLICATION_COMMAND_PERMISSIONS_V2',        // guild is using the old permissions configuration behavior
        'AUTO_MODERATION',                           // guild has set up auto moderation rules
        'BANNER',                                    // guild has access to set a guild banner image
        'COMMUNITY',                                 // guild can enable welcome screen, Membership Screening, stage channels and discovery, and receives community updates
        'CREATOR_MONETIZABLE_PROVISIONAL',           // guild has enabled monetization
        'CREATOR_STORE_PAGE',                        // guild has enabled the role subscription promo page
        'DEVELOPER_SUPPORT_SERVER',                  // guild has been set as a support server on the App Directory
        'DISCOVERABLE',                              // guild is able to be discovered in the directory
        'FEATURABLE',                                // guild is able to be featured in the directory
        'INVITES_DISABLED',                          // guild has paused invites, preventing new users from joining
        'INVITE_SPLASH',                             // guild has access to set an invite splash background
        'MEMBER_VERIFICATION_GATE_ENABLED',          // guild has enabled Membership Screening
        'MORE_SOUNDBOARD',                           // guild has increased custom soundboard sound slots
        'MORE_STICKERS',                             // guild has increased custom sticker slots
        'NEWS',                                      // guild has access to create announcement channels
        'PARTNERED',                                 // guild is partnered
        'PREVIEW_ENABLED',                           // guild can be previewed before joining via Membership Screening or the directory
        'RAID_ALERTS_DISABLED',                      // guild has disabled alerts for join raids in the configured safety alerts channel
        'ROLE_ICONS',                                // guild is able to set role icons
        'ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE', // guild has role subscriptions that can be purchased
        'ROLE_SUBSCRIPTIONS_ENABLED',                // guild has enabled role subscriptions
        'SOUNDBOARD',                                // guild has created soundboard sounds
        'TICKETED_EVENTS_ENABLED',                   // guild has enabled ticketed events
        'VANITY_URL',                                // guild has access to set a vanity URL
        'VERIFIED',                                  // guild is verified
        'VIP_REGIONS',                               // guild has access to set 384kbps bitrate in voice (previously VIP voice servers)
        'WELCOME_SCREEN_ENABLED',                    // guild has enabled the welcome screen
    ])],
    mfa_level: new Enum({                          // required MFA level for the guild
        NONE:     0, // guild has no MFA/2FA requirement for moderation actions
        ELEVATED: 1	 // guild has a 2FA requirement for moderation actions
    }),
    application_id: [string, null],                // application id of the guild creator if it is bot-created
    system_channel_id: [string, null],             // the id of the channel where guild notices such as welcome messages and boost events are posted
    system_channel_flags: new Flags([              // system channel flags
        'SUPPRESS_JOIN_NOTIFICATIONS',                              // Suppress member join notifications
        'SUPPRESS_PREMIUM_SUBSCRIPTIONS',                           // Suppress server boost notifications
        'SUPPRESS_GUILD_REMINDER_NOTIFICATIONS',                    // Suppress server setup tips
        'SUPPRESS_JOIN_NOTIFICATION_REPLIES',                       // Hide member join sticker reply buttons
        'SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATIONS',        // Suppress role subscription purchase and renewal notifications
        'SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATION_REPLIES', // Hide role subscription sticker reply buttons
    ]),
    rules_channel_id: [string, null],              // the id of the channel where Community guilds can display rules and/or guidelines
    max_presences: [number, null],                 // the maximum number of presences for the guild (null is always returned, apart from the largest of guilds)
    max_members: [number, null],                   // the maximum number of members for the guild
    vanity_url_code: [string, null],               // the vanity url code for the guild
    description: [string, null],                   // the description of a guild
    banner: [string, null],                        // banner hash
    premium_tier: new Enum({                       // premium tier (Server Boost level)
        NONE:   0, // guild has not unlocked any Server Boost perks
        TIER_1: 1, // guild has unlocked Server Boost level 1 perks
        TIER_2: 2, // guild has unlocked Server Boost level 2 perks
        TIER_3: 3  // guild has unlocked Server Boost level 3 perks
    }),
    premium_subscription_count: number,            // the number of boosts this guild currently has
    preferred_locale: Locale,                      // the preferred locale of a Community guild; used in server discovery and notices from Discord, and sent in interactions; defaults to "en-US"
    public_updates_channel_id: [string, null],     // the id of the channel where admins and moderators of Community guilds receive notices from Discord
    max_video_channel_users: [number, null],       // the maximum amount of users in a video channel
    max_stage_video_channel_users: [number, null], // the maximum amount of users in a stage video channel
    approximate_member_count: [number, null],      // approximate number of members in this guild, returned from the GET /guilds/<id> and /users/@me/guilds endpoints when with_counts is true
    approximate_presence_count: [number, null],    // approximate number of non-offline members in this guild, returned from the GET /guilds/<id> and /users/@me/guilds endpoints when with_counts is true
    welcome_screen: [{                             // the welcome screen of a Community guild, shown to new members, returned in an Invite's guild object
        description: [string, null], // the server description shown in the welcome screen
        welcome_channels: ['...', {  // the channels shown in the welcome screen, up to 5
            channel_id: string,        // the channel's id
            description: string,       // the description shown for the channel
            emoji_id: [string, null],  // the emoji id, if the emoji is custom
            emoji_name: [string, null] // the emoji name if custom, the unicode character if standard, or null if no emoji is set
        }]
    }, null],
    incidents_data: [{
        raid_detected_at: [string, null],
        invites_disabled_until: [string, null],
        dms_disabled_until: [string, null],
        dm_spam_detected_at: [string, null]
    }, null],
    home_header: [string, null],
    latest_onboarding_question_id: [string, null],
    nsfw: [boolean, null],
    nsfw_level: new Enum({                         // guild NSFW level
        DEFAULT:        0,
        EXPLICIT:       1,
        SAFE:           2,
        AGE_RESTRICTED: 3
    }),
    stickers: [['...', Sticker], null],            // custom guild stickers
    premium_progress_bar_enabled: boolean,         // whether the guild has the boost progress bar enabled
    safety_alerts_channel_id: [string, null]       // the id of the channel where admins and moderators of Community guilds receive safety alerts from Discord
}
Guild.properties[0] = Guild;
export const ApplicationInstallParams = {
    scopes: ['...', new Enum([ // Scopes to add the application to the server with
        'activities.read',                          // allows your app to fetch data from a user's "Now Playing/Recently Played" list — not currently available for apps
        'activities.write',                         // allows your app to update a user's activity - not currently available for apps (NOT REQUIRED FOR GAMESDK ACTIVITY MANAGER)
        'applications.builds.read',                 // allows your app to read build data for a user's applications
        'applications.builds.upload',               // allows your app to upload/update builds for a user's applications - requires Discord approval
        'applications.commands',                    // allows your app to add commands to a guild - included by default with the bot scope
        'applications.commands.update',             // allows your app to update its commands using a Bearer token - client credentials grant only
        'applications.commands.permissions.update', // allows your app to update permissions for its commands in a guild a user has permissions to
        'applications.entitlements',                // allows your app to read entitlements for a user's applications
        'applications.store.update',                // allows your app to read and update store data (SKUs, store listings, achievements, etc.) for a user's applications
        'bot',                                      // for oauth2 bots, this puts the bot in the user's selected guild by default
        'connections',                              // allows /users/@me/connections to return linked third-party accounts
        'dm_channels.read',                         // allows your app to see information about the user's DMs and group DMs - requires Discord approval
        'email',                                    // enables /users/@me to return an email
        'gdm.join',                                 // allows your app to join users to a group dm
        'guilds',                                   // allows /users/@me/guilds to return basic information about all of a user's guilds
        'guilds.join',                              // allows /guilds/{guild.id}/members/{user.id} to be used for joining users to a guild
        'guilds.members.read',                      // allows /users/@me/guilds/{guild.id}/member to return a user's member information in a guild
        'identify',                                 // allows /users/@me without email
        'messages.read',                            // for local rpc server api access, this allows you to read messages from all client channels (otherwise restricted to channels/guilds your app creates)
        'relationships.read',                       // allows your app to know a user's friends and implicit relationships - requires Discord approval
        'role_connections.write',                   // allows your app to update a user's connection and metadata for the app
        'rpc',                                      // for local rpc server access, this allows you to control a user's local Discord client - requires Discord approval
        'rpc.activities.write',                     // for local rpc server access, this allows you to update a user's activity - requires Discord approval
        'rpc.notifications.read',                   // for local rpc server access, this allows you to receive notifications pushed out to the user - requires Discord approval
        'rpc.voice.read',                           // for local rpc server access, this allows you to read a user's voice settings and listen for voice events - requires Discord approval
        'rpc.voice.write',                          // for local rpc server access, this allows you to update a user's voice settings - requires Discord approval
        'voice',                                    // allows your app to connect to voice on user's behalf and see all the voice members - requires Discord approval
        'webhook.incoming',                         // this generates a webhook that is returned in the oauth token response for authorization code grants
    ])],
    permissions: string,       // Permissions to request for the bot role
}
export const ApplicationContextTypes = new Enum({
    GUILD_INSTALL: 0, // App is installable to servers
    USER_INSTALL:  1, // App is installable to users
});
export const Application = {
    id: string,                                        // ID of the app
    name: string,                                      // Name of the app
    icon: [string, null],                              // Icon hash of the app
    description: string,                               // Description of the app
    rpc_origins: [['...', string], null],              // List of RPC origin URLs, if RPC is enabled
    bot_public: boolean,                               // When false, only the app owner can add the app to guilds
    bot_require_code_grant: boolean,                   // When true, the app's bot will only join upon completion of the full OAuth2 code grant flow
    bot: [User, null],                                 // Partial user object for the bot user associated with the app
    terms_of_service_url: [string, null],              // URL of the app's Terms of Service
    privacy_policy_url: [string, null],                // URL of the app's Privacy Policy
    owner: [User, null],                               // Partial user object for the owner of the app
    verify_key: string,                                // Hex encoded key for verification in interactions and the GameSDK's GetTicket
    team: [{                                           // If the app belongs to a team, this will be a list of the members of that team
        icon: [string, null],  // Hash of the image of the team's icon
        id: string,            // Unique ID of the team
        members: ['...', {     // Members of the team
            membershit_state: new Enum({ // User's membership state on the team
                INVITED:  1,
                ACCEPTED: 2
            }),
            team_id: string,             // ID of the parent team of which they are a member
            user: User,                  // Avatar, discriminator, ID, and username of the user
            role: new Enum({             // Role of the team member
                Owner:       '',          // Owners are the most permissible role, and can take destructive, irreversible actions like deleting team-owned apps or the team itself. Teams are limited to 1 owner.
                Admin:       'admin',     // Admins have similar access as owners, except they cannot take destructive actions on the team or team-owned apps.
                Developer:   'developer', // Developers can access information about team-owned apps, like the client secret or public key. They can also take limited actions on team-owned apps, like configuring interaction endpoints or resetting the bot token. Members with the Developer role cannot manage the team or its members, or take destructive actions on team-owned apps.
                'Read-only': 'read-only'  // Read-only members can access information about a team and any team-owned apps. Some examples include getting the IDs of applications and exporting payout records. Members can also invite bots associated with team-owned apps that are marked private.
            }),

        }],
        name: string,          // Name of the team
        owner_user_id: string, // User ID of the current team owner
    }, null],
    guild_id: [string, null],                          // Guild associated with the app. For example, a developer support server.
    guild: [Guild, null],                              // Partial object of the associated guild
    primary_sku_id: [string, null],                    // If this app is a game sold on Discord, this field will be the id of the "Game SKU" that is created, if exists
    slug: [string, null],                              // If this app is a game sold on Discord, this field will be the URL slug that links to the store page
    cover_image: [string, null],                       // App's default rich presence invite cover image hash
    flags: [new Flags([                                // App's public flags
        null, null, null, null, null, null,
        'APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE', // Indicates if an app uses the Auto Moderation API
        null, null, null, null, null,
        'GATEWAY_PRESENCE',                              // Intent required for bots in 100 or more servers to receive presence_update events
        'GATEWAY_PRESENCE_LIMITED',                      // Intent required for bots in under 100 servers to receive presence_update events, found on the Bot page in your app's settings
        'GATEWAY_GUILD_MEMBERS',                         // Intent required for bots in 100 or more servers to receive member-related events like guild_member_add. See the list of member-related events under GUILD_MEMBERS
        'GATEWAY_GUILD_MEMBERS_LIMITED',                 // Intent required for bots in under 100 servers to receive member-related events like guild_member_add, found on the Bot page in your app's settings. See the list of member-related events under GUILD_MEMBERS
        'VERIFICATION_PENDING_GUILD_LIMIT',              // Indicates unusual growth of an app that prevents verification
        'EMBEDDED',                                      // Indicates if an app is embedded within the Discord client (currently unavailable publicly)
        'GATEWAY_MESSAGE_CONTENT',                       // Intent required for bots in 100 or more servers to receive message content
        'GATEWAY_MESSAGE_CONTENT_LIMITED',               // Intent required for bots in under 100 servers to receive message content, found on the Bot page in your app's settings
        null, null,
        'APPLICATION_COMMAND_BADGE',                     // Indicates if an app has registered global application commands
    ]), null],
    approximate_guild_count: [number, null],           // Approximate count of guilds the app has been added to
    approximate_user_install_count: [number, null],    // Approximate count of users that have installed the app
    redirect_uris: [['...', string], null],            // Array of redirect URIs for the app
    interactions_endpoint_url: [string, null],         // Interactions endpoint URL for the app
    role_connections_verification_url: [string, null], // Role connection verification URL for the app
    event_webhooks_url: [string, null],                // Event webhooks URL for the app to receive webhook events
    event_webhooks_status: [new Enum({                 // If webhook events are enabled for the app. 1 (default) means disabled, 2 means enabled, and 3 means disabled by Discord
        DISABLED:            1, // Webhook events are disabled by developer
        ENABLED:             2, // Webhook events are enabled by developer
        DISABLED_BY_DISCORD: 3, // Webhook events are disabled by Discord, usually due to inactivity
    }), null],
    event_webhooks_types: [['...', new Enum({          // List of Webhook event types the app subscribes to
        ApplicationAuthorized: 'APPLICATION_AUTHORIZED', // Sent when an app was authorized by a user to a server or their account
        EntitlementCreate:     'ENTITLEMENT_CREATE',     // Entitlement was created
        QuestUserEnrollment:   'QUEST_USER_ENROLLMENT',  // User was added to a Quest (currently unavailable)
    })], null],
    tags: [['...', string], null],                     // List of tags describing the content and functionality of the app. Max of 5 tags.
    install_params: [ApplicationInstallParams, null],  // Settings for the app's default in-app authorization link, if enabled
    integration_types_config: [['...', new Dict(       // Default scopes and permissions for each supported installation context. Value for each key is an integration type configuration object
        ApplicationContextTypes, 
        { oauth2_install_params: [ApplicationInstallParams, null] } // Install params for each installation context's default in-app authorization link
    )], null],       
    custom_install_url: [string, null],                // Default custom authorization URL for the app, if enabled
}
export const InteractionType = new Enum({
    PING:                             1,
    APPLICATION_COMMAND:              2,
    MESSAGE_COMPONENT:                3,
    APPLICATION_COMMAND_AUTOCOMPLETE: 4,
    MODAL_SUBMIT:                     5,
});
export const MessagePollMedia = {
    text: [string, null], // The text of the field
    emoji: [Emoji, null], // The emoji of the field
}
export const Attachment = {
    id: string,
    filename: string,
    title: [string, null],
    description: [string, null],
    content_type: [string, null],
    size: number,
    url: string,
    proxy_url: string,
    width: [number, null],
    height: [number, null],
    ephemeral: [boolean, null],
    duration_secs: [number, null],
    waveform: [string, null],
    flags: new Flags([ null, null, 'IS_REMIX' ]),
}
export const Message = {
    id: string,
    channel_id: string,
    channel_type: [ChannelType, null],
    author: [User, null],
    author_id: [string, null],
    content: string,
    timestamp: string,
    edited_timestamp: [string, null],
    tts: boolean,
    mention_everyone: boolean,
    mentions: ['...', User],
    mention_roles: ['...', string],
    mention_channels: [['...', {
        id: string,
        guild_id: string,
        type: ChannelType,
        name: string
    }], null],
    attachments: ['...', Attachment],
    embeds: ['...', {
        title: [string, null],
        type: [string, null],
        description: [string, null],
        url: [string, null],
        timestamp: [string, null],
        color: [number, null],
        footer: [{
            text: string,
            icon_url: [string, null],
            proxy_icon_url: [string, null]
        }, null],
        image: [{
            url: string,
            proxy_url: [string, null],
            width: [number, null],
            height: [number, null]
        }, null],
        thumbnail: [{
            url: string,
            proxy_url: [string, null],
            width: [number, null],
            height: [number, null]
        }, null],
        video: [{
            url: [string, null],
            proxy_url: [string, null],
            width: [number, null],
            height: [number, null]
        }, null],
        provider: [{
            name: [string, null],
            url: [string, null]
        }, null],
        author: [{
            name: string,
            url: [string, null],
            icon_url: [string, null],
            proxy_icon_url: [string, null]
        }, null],
        fields: [['...', {
            name: string,
            value: string,
            inline: [boolean, null]
        }, 0, 25], null],
    }],
    reactions: ['...', {
        count: number,
        count_details: {
            burst: number,
            normal: number
        },
        me: boolean,
        me_burst: boolean,
        emoji: Emoji,
        burst_color: ['...', string]
    }],
    nonce: [string, number, null],
    pinned: boolean,
    webhook_id: [string, null],
    type: MessageType,
    activity: [{
        type: MessageActivityType,
        party_id: [string, null]
    }, null],
    application: [Application, null],
    application_id: [string, null],
    flags: [new Flags([
        'CROSSPOSTED',                            // this message has been published to subscribed channels (via Channel Following)
        'IS_CROSSPOST',                           // this message originated from a message in another channel (via Channel Following)
        'SUPPRESS_EMBEDS',                        // do not include any embeds when serializing this message
        'SOURCE_MESSAGE_DELETED',                 // the source message for this crosspost has been deleted (via Channel Following)
        'URGENT',                                 // this message came from the urgent message system
        'HAS_THREAD',                             // this message has an associated thread, with the same id as the message
        'EPHEMERAL',                              // this message is only visible to the user who invoked the Interaction
        'LOADING',                                // this message is an Interaction Response and the bot is "thinking"
        'FAILED_TO_MENTION_SOME_ROLES_IN_THREAD', // this message failed to mention some roles and add their members to the thread
        'SUPPRESS_NOTIFICATIONS',                 // this message will not trigger push and desktop notifications
        'IS_VOICE_MESSAGE',                       // this message is a voice message
    ]), null],
    message_reference: [{
        type: [new Enum({                   // type of reference.
            DEFAULT: 0, // A standard reference used by replies.
            FORWARD: 1, // Reference used to point to a message at a point in time.
        }), null],
        message_id: [string, null],         // id of the originating message
        channel_id: [string, null],         // id of the originating message's channel
        guild_id: [string, null],           // id of the originating message's guild
        fail_if_not_exists: [boolean, null] // when sending, whether to error if the referenced message doesn't exist instead of sending as a normal (non-reply) message, default true
    }, null],
    message_snapshots: [['...', { message: null }], null],
    referenced_message: [null, null],
    interaction_metadata: [{
        id: string,                                   // ID of the interaction
        type: InteractionType,                        // Type of interaction
        user: User,                                   // User who triggered the interaction
        authorizing_integration_owners: Any,          // IDs for installation context(s) related to an interaction. Details in Authorizing Integration Owners Object
        original_response_message_id: [string, null], // ID of the original response message, present only on follow-up messages
        target_user: [User, null],                    // The user the command was run on, present only on user command interactions
        target_message_id: [string, null],            // The ID of the message the command was run on, present only on message command interactions. The original response message will also have message_reference and referenced_message pointing to this message.
    }, null],
    interaction: {
        id: string,            // ID of the interaction
        type: InteractionType, // Type of interaction
        name: string,          // Name of the application command, including subcommands and subcommand groups
        user: User,            // User who invoked the interaction
        member: Member,        // Member who invoked the interaction in the guild
    },
    thread: [Channel, null],
    components: [Components, null],
    sticker_items: [['...', {
        id: string,                      // id of the sticker
        name: string,                    // name of the sticker
        format_type: Sticker.format_type // type of sticker format
    }], null],
    stickers: [['...', Sticker], null],
    position: [number, null],
    role_subscription_data: [{
        role_subscription_listing_id: string, // the id of the sku and listing that the user is subscribed to
        tier_name: string,                    // the name of the tier that the user is subscribed to
        total_months_subscribed: number,      // the cumulative number of months that the user has been subscribed for
        is_renewal: boolean,                  // whether this notification is for a renewal rather than a new purchase
    }, null],
    resolved: [{
        users: [new Dict(string, User), null],             // IDs and User objects
        members: [new Dict(string, Member), null],         // IDs and partial Member objects
        roles: [new Dict(string, Role), null],             // IDs and Role objects
        channels: [new Dict(string, Channel), null],       // IDs and partial Channel objects
        messages: [null, null],                            // IDs and partial Message objects
        attachments: [new Dict(string, Attachment), null], // IDs and attachment objects
    }, null],
    poll: [{
        question: MessagePollMedia, // The question of the poll. Only text is supported.
        answers: ['...', { // Each of the answers available in the poll.
            answer_id: number,            // The ID of the answer
            poll_media: MessagePollMedia, // The data of the answer
        }],
        expiry: [string, null], // The time when the poll ends.
        allow_multiselect: boolean, // Whether a user can select multiple answers
        layout_type: new Enum({ // The layout type of the poll
            DEFAULT: 1 // The, uhm, default layout type.
        }),
        results: { // The results of the poll
            is_finalized: boolean, // Whether the votes have been precisely counted
            answer_counts: ['...', { // The counts for each answer
                id: string, // The answer_id
                count: number, // The number of votes for this answer
                me_voted: boolean, // Whether the current user voted for this answer
            }]
        }
    }, null],
    call: [{
        participants: ['...', string], // array of user object ids that participated in the call
        ended_timestamp: [string, null], // time when call ended
    }, null],
    member: [Member, null],
    guild_id: [string, null]
}
Message.resolved[0].messages = new Dict(string, Message);
Message.referenced_message[0] = Message;
Message.message_snapshots[0][1].message = Message;