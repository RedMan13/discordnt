function findBitEdge(num) {
    for (let i = 31; i > 0; i--) {
        if ((num >> i) & 0b1) return 1 << i;
    }
}
export const CDNHost = 'cdn.discordapp.com';
export const isDiscord = /^https?:\/\/(?:[a-z-\-0-9]+\.)?discord(?:app)?\.(?:com|net)/;
const map = (url, types) => {
    let funcStr = `return \`https://${CDNHost}/`;
    let lastIdx = 0;
    for (const m of url.matchAll(/\{[$_a-z][$_0-9a-z]*(\.(?<objVarPath>[$_a-z][$_0-9a-z\.]*?))?\}/gi)) {
        funcStr += url.slice(lastIdx, m.index);
        lastIdx = m.index + m[0].length;
        funcStr += '${obj';
        const path = m.groups.objVarPath ?? '';
        if (path.length) funcStr += '.' + path;
        funcStr += '}';
    }
    funcStr += '`'
    const mapFunc = new Function('obj', funcStr);
    return function(obj, type, size, css) {
        if (!types.includes(type)) type = 'png';
        const url = `${mapFunc(obj)}.${type}?size=${findBitEdge(size)}`;
        if (typeof css !== 'string') return url;
        const img = new Image(size, size);
        img.src = url;
        img.setAttribute('style', css);
        return img;
    }
}
export const Asset = {
    CustomEmoji:              map('emojis/{emoji.id}',                                                           ['png', 'jpeg', 'webp', 'gif'        ]),
    GuildIcon:                map('icons/{guild.id}/{guild.icon}',                                               ['png', 'jpeg', 'webp', 'gif'        ]),
    GuildSplash:              map('splashes/{guild.id}/{guild.splash}',                                          ['png', 'jpeg', 'webp'               ]),
    GuildDiscoverySplash:     map('discovery-splashes/{guild.id}/{guild.discovery_splash}',                      ['png', 'jpeg', 'webp'               ]),
    GuildBanner:              map('banners/{guild.id}/{guild.banner}',                                           ['png', 'jpeg', 'webp', 'gif'        ]),
    UserBanner:               map('banners/{user.id}/{user.banner}',                                             ['png', 'jpeg', 'webp', 'gif'        ]),
    DefaultUserAvatar:        map('embed/avatars/{index}',                                                       ['png'                               ]),
    UserAvatar:               map('avatars/{user.id}/{user.avatar}',                                             ['png', 'jpeg', 'webp', 'gif'        ]),
    GuildMemberAvatar:        map('guilds/{member.guild_id}/users/{member.user_id}/avatars/{member.alt_avatar}', ['png', 'jpeg', 'webp', 'gif'        ]),
    AvatarDecoration:         map('avatar-decoration-presets/{decoration.asset}',                                ['png'                               ]),
    ApplicationIcon:          map('app-icons/{app.id}/icon',                                                     ['png', 'jpeg', 'webp'               ]),
    ApplicationCover:         map('app-icons/{app.id}/{app.cover_image}',                                        ['png', 'jpeg', 'webp'               ]),
    ApplicationAsset:         map('app-assets/{app.id}/{app.asset}',                                             ['png', 'jpeg', 'webp'               ]),
    AchievementIcon:          map('app-assets/{app.id}/achievements/{app.achievement}/icons/{app.icon}',         ['png', 'jpeg', 'webp'               ]),
    StorePageAsset:           map('app-assets/{app.id}/store/{app.asset}',                                       ['png', 'jpeg', 'webp'               ]),
    StickerPackBanner:        map('app-assets/710982414301790216/store/{id}',                                    ['png', 'jpeg', 'webp'               ]),
    TeamIcon:                 map('team-icons/{team.id}/{team.icon}',                                            ['png', 'jpeg', 'webp'               ]),
    Sticker:                  map('stickers/{sticker.id}',                                                       ['png',                 'gif', 'json']),
    RoleIcon:                 map('role-icons/{role.id}/{role.icon}',                                            ['png', 'jpeg', 'webp'               ]),
    GuildScheduledEventCover: map('guild-events/{event.id}/{event.image}',                                       ['png', 'jpeg', 'webp'               ]),
    GuildMemberBanner:        map('guilds/{guild.id}/users/{user.id}/banners/{user.banner}',                     ['png', 'jpeg', 'webp', 'gif'        ]),
    ChannelIcon:              map('channel-icons/{channel.id}/{channel.icon}',                                   ['png', 'jpeg', 'webp', 'gif'        ])
};

export function gifOrWebp(asset) {
    return asset.startsWith('a_')
        ? 'gif'
        : 'webp'
}