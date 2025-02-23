import { Asset } from "./api/asset-helper.js";
import { ChannelType } from "./api/type-enums.js";

function getSort(guildId) {
    const index = client.settings.guildFolders.guildPositions.findIndex(id => id == guildId);
    return index < 0 ? null : index;
}
export function sendNewListing() {
    const map = Object.values(client.guilds)
        .map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: Asset.GuildIcon(guild, 'png', 24),
            // lookup the index of this guild inside guild positions to provide the sorting
            // index
            sort: getSort(guild.id),
            members: Object.values(Object.values(guild.channels)
                .reduce((cur, channel) => {
                    if (!channel.parent_id) {
                        cur[channel.id] = {
                            id: channel.id,
                            name: channel.name,
                            sort: channel.position,
                            selected: channel.id === channel,
                            members: cur[channel.id]?.members ?? []
                        };
                        if (channel.type !== ChannelType.GUILD_CATEGORY) {
                            cur[channel.id].resolve = `#${channel.id}`;
                            if (!cur[channel.id].members.length)
                                delete cur[channel.id].members;
                        }
                        return cur;
                    
                    }
                    cur[channel.parent_id] ??= { id: channel.parent_id, members: [] };
                    cur[channel.parent_id].members.push({
                        id: channel.id,
                        name: channel.name,
                        sort: channel.position,
                        resolve: `#${channel.id}`,
                        selected: channel.id === channel
                    });
                    return cur;
                }, {}))
                .reduce((cur, member, idx, members) => {
                    if (typeof member.name === 'undefined') {
                        let realParent;
                        for (const folder of members) {
                            if (folder.members)
                                for (const channel of folder.members)
                                    if (channel.id === member.id)
                                        realParent = channel;
                            if (folder.id === member.id)
                                realParent = folder;

                            if (realParent) break;
                        }
                        realParent.members = member.members;
                        return cur;
                    }
                    cur.push(member);
                    return cur;
                }, [])
        }));
    updateBrowser({
        name: 'DiscordNT',
        members: client.settings.guildFolders.folders
            .map(folder => {
                const guilds = folder.guildIds
                    .map(guildId => map.find(({ id }) => id == guildId))
                    .filter(guild => guild)
                    .map((guild, idx) => (guild.sort = idx, guild));
                if (guilds.length <= 0) return;
                if (guilds.length === 1) {
                    if (folder.id) guilds[0].sort = getSort(folder.id.value);
                    return guilds[0];
                }
                
                return {
                    name: folder.name?.value ?? guilds
                        .slice(0, -1)
                        .map(({ name }) => name)
                        .join(', ')
                        .concat(` and ${guilds.at(-1).name}`),
                    sort: getSort(folder.id.value) ?? guilds[0].sort,
                    members: guilds
                }
            })
            .filter(member => member)
    });
}