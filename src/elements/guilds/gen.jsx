import { Asset, gifOrWebp } from "../../api/asset-helper.js";
import { UserAvatar } from "../profile.jsx";
import { ChannelType } from "../../api/type-enums.js";
import GuildTextIcon from './guild-text.svg';
import GuildVoiceIcon from './guild-voice.svg';
import GuildAnnouncementIcon from './guild-announcement.svg';
import MiddleThreadIcon from './middle-thread.svg';
import EndThreadIcon from './end-thread.svg';
import GuildStageIcon from './guild-stage.svg';
import GuildForumIcon from './guild-forum.svg';
import GuildMediaIcon from './guild-media.svg';

const userDms = 'user-dms';
let viewingGuild = '';
export function fillGuilds() {
    const root = document.getElementById('browser');
    const guildsBar = <div style="
        display: inline-block;
        height: 100%; 
        width: max-content;
        background-color: rgba(0,0,0, 25%);
        overflow-y: scroll;
        padding: 0px 4px;
    "></div>;
    root.appendChild(guildsBar);
    const folders = client.askFor('myServers');
    folders.unshift({
        servers: [{
            name: 'Direct Messages',
            id: userDms
        }]
    }, { isSep: true });
    for (const folder of folders) {
        if (folder.isSep) {
            guildsBar.appendChild(<hr style="margin: 2px 0px; padding: 0px 4px;" />);
            continue;
        }
        const guilds = folder.servers.map(guild => <div 
                id={guild.id}
                style={`
                    width: 2rem; 
                    height: 2rem; 
                    margin: 2px 0px;
                    display: flex;
                    border-radius: ${viewingGuild == guild.id ? '0.5rem' : '1rem'};
                    overflow: hidden;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                    background-color: rgba(0,0,0, 25%);
    
                `}
                title={guild.name}
                on:click={e => {
                    if (viewingGuild === guild.id) return;
                    const old = document.getElementById(viewingGuild);
                    if (old) 
                        old.style.borderRadius = '1rem';
                    const next = document.getElementById(guild.id);
                    if (next)
                        next.style.borderRadius = '0.5rem';
                    viewingGuild = guild.id;
                    fillChannels();
                }}
            >
                {guild.icon
                    ? Asset.GuildIcon(guild, gifOrWebp(guild.icon), 256, 'width: 100%; height: 100%;')
                    : <span style={`
                        font-size: 1.5cqmin;  
                    `}>{guild.name
                        .split(/\s+/)
                        .map(word => word.length <= 2 
                            ? word[0].toLowerCase() 
                            : word[0].toUpperCase())
                        .join('')}</span>}
            </div>);
        if (guilds.length <= 1) { guildsBar.appendChild(guilds[0]); continue; }
        const folderEl = <div
            id={folder.id}
            title={folder.name}
            style={`
                border-radius: 0.5rem;
                background-color: rgba(${(folder.color >> 16) & 0xFF},${(folder.color >> 8) & 0xFF},${folder.color & 0xFF}, 25%);
                width: max-content;
                margin: 2px 0px;
                height: 2rem;
                overflow: hidden;
            `}
        >
            <div 
                style="
                    width: 2rem; 
                    height: 2rem; 
                    margin-bottom: 2px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                "
                class="guild-folder"
                on:click={() => {
                    folderEl.style.height = folderEl.style.height === '2rem'
                        ? 'max-content'
                        : '2rem';
                }}
            >
                <span style={`
                    color: ${'#' + folder.color.toString(16).padStart(6, '0')};
                    font-size: 1rem;
                `}>🖿</span>
            </div>
            {guilds}
        </div>
        guildsBar.appendChild(folderEl)
    }
}

async function generateChannels(folder, hide) {
    const selected = client.askFor('Messages.channel');
    const out = <div style="
        width: max-content;
        padding-left: 3px;
    "></div>;
    for (const [idx, channel] of Object.entries(folder.sort((a,b) => a.sort - b.sort))) { 
        if (channel.type === ChannelType.GUILD_CATEGORY) {
            const gen = await generateChannels(channel.members, channel.collapsed || hide);
            out.appendChild(<div>
                <div 
                    style="cursor: pointer;" 
                    id={channel.id}
                    on:click={async () => {
                        channel.collapsed = !channel.collapsed;
                        const self = document.getElementById(channel.id);
                        self.children[0].style.transform = channel.collapsed
                            ? 'translate(0, -0.4rem) rotate(-90deg)'
                            : 'translate(0, -0.4rem) rotate(0deg)';
                        const channels = self.parentElement.children[1];
                        channels.remove();
                        const gen = await generateChannels(channel.members, channel.collapsed);
                        self.parentElement.appendChild(gen);
                        client.askFor('setGuildSettings', { channel_overrides: [channel] })
                    }}
                >
                    <span style={`
                        transform: translate(0, -0.4rem) rotate(${channel.collapsed ? '-90' : '0'}deg);
                        transform-origin: 4.5px 22px;
                        display: inline-block;
                        font-size: 1.3rem; 
                    `}>⌄</span>
                    <span style="
                        font-size: 0.8rem; 
                        margin-left: 2px;
                        color: hsl(0, 0%, 10%);
                    ">{channel.name}</span>
                </div>
                {gen}
            </div>)
            continue;
        }
        let icon;
        switch (channel.type) {
        case ChannelType.GUILD_TEXT:
            icon = <GuildTextIcon style="width: 100%" />; break;
        case ChannelType.DM:
            const user = client.askFor('Users.getUser', channel.id);
            icon = <UserAvatar user={user.id} />;
            break;
        case ChannelType.GUILD_VOICE:
            icon = <GuildVoiceIcon style="width: 100%" />; break;
        case ChannelType.GROUP_DM:
            const group = client.askFor('Channels.get', channel.id);
            const altDis = group.recipient_ids[0] ?? group.owner_id;
            channel.name ??= altDis.username;
            icon = group.icon 
                ? Asset.ChannelIcon(group, 'webp', 24, `
                    width: calc(1lh - 4.6167px);
                    height: calc(1lh - 4.6167px);
                    margin-left: 2.3083px;
                    border-radius: 50%;
                `)
                : <UserAvatar user={altDis} />;
            break;
        case ChannelType.GUILD_ANNOUNCEMENT:
            icon = <GuildAnnouncementIcon style="width: 100%" />; break;
        case ChannelType.ANNOUNCEMENT_THREAD:
        case ChannelType.PUBLIC_THREAD:
        case ChannelType.PRIVATE_THREAD:
            icon = idx === folder.length -1
                ? <EndThreadIcon style="width: 100%" />
                : <MiddleThreadIcon style="width: 100%" />; break;
        case ChannelType.GUILD_ANNOUNCEMENT:
            icon = <GuildStageIcon style="width: 100%" />; break;
        case ChannelType.GUILD_FORUM:
            icon = <GuildForumIcon style="width: 100%" />; break;
        case ChannelType.GUILD_MEDIA:
            icon = <GuildMediaIcon style="width: 100%" />; break;
        }
        const hidden = hide && selected !== channel.id /*&&
            ([ChannelType.ANNOUNCEMENT_THREAD, ChannelType.PUBLIC_THREAD, ChannelType.PRIVATE_THREAD]
                .includes(channel.type) && !isUnread)*/ // unread messages my beloved
        out.appendChild(<div 
            id={channel.id}
            style={`
                ${hidden ? 'display: none;' : ''}
                border-radius: 5px;
                margin: 2px 0px;
                cursor: pointer;
                ${selected === channel.id ? 'background-color: rgba(0,0,0, 12.5%);' : ''}
            `} 
            class="guild-channel"
            on:click={e => {
                const selected = client.askFor('Messages.channel');
                const old = document.getElementById(selected);
                if (old)
                    old.style.backgroundColor = 'none';
                const next = document.getElementById(channel.id);
                if (next)
                    next.style.backgroundColor = 'rgba(0,0,0, 12.5%)';
                location.hash = `#${channel.id}`;
            }}
        >
            <span style="
                display: inline-block; 
                width: 0.8lh;
                height: 1lh;
                vertical-align: bottom;
                padding-left: 5px; 
            ">{icon}</span>
            <span style="margin-left: 2px;">{channel.name}</span>
        </div>);
    }
    return out;
}
export async function fillChannels() {
    const root = document.getElementById('browser');
    const channels = client.askFor('Channels.toFolders', viewingGuild === userDms
        ? client.askFor('user_id')
        : viewingGuild
    );
    const gen = await generateChannels(channels);
    const old = document.getElementById('guild-channels');
    old?.remove?.()
    root.appendChild(<div 
        id="guild-channels" 
        style="
            display: inline-block;
            width: 100%;
            overflow-y: scroll;
            overflow-x: hidden;
        "
    >{gen}</div>);
}
export async function fillViewer() {
    const root = document.getElementById('browser');
    root.innerHTML = '';
    root.style.display = 'grid';
    root.style.gridTemplateColumns = 'auto auto';
    viewingGuild = client.askFor('Messages.guild') || userDms;
    fillGuilds();
    fillChannels();
}