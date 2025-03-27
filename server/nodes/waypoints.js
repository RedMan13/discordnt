import path from 'node:path';

export function parseWaypointData(string) {
    string = string.trim().replace(/\(.*?\)/gi, '');
    const coords = {};
    const lines = string.split('\n').filter(Boolean).map(line => line.trim());
    lines.shift();
    // parse lines as waypoints
    let category = 'Other';
    for (const line of lines) {
        if (line.startsWith('__')) { category = line.slice(2, -3); continue; }
        if (line.startsWith('~~')) continue;
        if (line.startsWith('==')) break;
        const colon = line.indexOf(':');
        const name = line.slice(0, colon);
        const poses = [];
        const toGetNames = line.slice(colon +1).replace(/`(-?[0-9]+),\s*(-?[0-9]+),\s*(-?[0-9]+)`(?:<?:(.*?):(?:[0-9]+>)?)?/g, (m, X, Y, Z, dim) => {
            if (dim?.includes?.('nether')) dim = 'nether';
            else if (dim?.includes?.('end')) dim = 'end';
            else dim = 'overworld';
            poses.push([X, Y, Z, dim]);
            return '';
        });
        for (const name of toGetNames.split(/,\s*|\s*or\s*|\s*and\s*/ig))
            if (name) poses.push(name.toLowerCase().replace(/[^a-z]+/g, ''));
        if (!poses.length) continue;
        coords[name.toLowerCase().replace(/[^a-z]+/g, '')] = [name, category, poses];
    }
    // merge any duplicates
    for (const id in coords) {
        const coord = coords[id];
        for (const idx in coord[2]) {
            const pos = coord[2][idx];
            if (typeof pos !== 'string') continue;
            if (!coords[pos]) continue;
            coords[pos][0] += `, ${coord[0]}`,
            delete coord[2][idx];
        }
        coord[2] = coord[2].filter(Boolean);
        if (coord[2].length <= 0) delete coords[id];
    }
    // rebase coordenates to be on a per-dim basis
    const dimensions = {
        overworld: {},
        nether: {},
        end: {}
    }
    for (const id in coords) {
        const coord = coords[id];
        for (const pos of coord[2]) {
            if (typeof pos === 'string') continue;
            dimensions[pos[3]][id] ??= [coord[0], coord[1], []];
            dimensions[pos[3]][id][2].push(pos.slice(0, 3));
        }
    }
    dimensions.overworld = Object.values(dimensions.overworld);
    dimensions.nether = Object.values(dimensions.nether);
    dimensions.end = Object.values(dimensions.end);

    return dimensions;
}
export function waypointDataToText(data) {
    return data
        .map(waypoint => waypoint[2]
            .map(pos => [
                'waypoint', // must be present
                waypoint[0], waypoint[1][0], pos[0], pos[1], pos[2], waypoint[1].charCodeAt(0) % 16, // actual configuration data
                false, 0, 'gui.xaero_default', false, 0, 0, false // config defaults that we dont care about for this
            ].join(':')))
        .flat()
        .join('\n');
}

export const validSettings = {
    directory: [['string'], { mustBe: 'folder' }],
    worldId: 'string',
    messageContentFragment: [['string', null], { dependsOn: 'guildId' }],
    guildId: [['string', null], { mustBe: 'guild' }],
    messageId: [['string', null], { dependsOn: 'channelId' }],
    channelId: [['string', null], { mustBe: 'channel' }]
}
export default async function(config, client, info) {
    const waypointFile = config.worldId + '.txt';
    const overworldFolder = path.resolve(config.directory, 'dim%0');
    const netherFolder = path.resolve(config.directory, 'dim%-1');
    const endFolder = path.resolve(config.directory, 'dim%1');
    function saveWaypointsFrom(string) {
        info('Converting waypoints message from discord into xaeros.');
        const { overworld, nether, end } = parseWaypointData(string);
        fs.mkdirSync(overworldFolder, { recursive: true });
        fs.mkdirSync(netherFolder, { recursive: true });
        fs.mkdirSync(endFolder, { recursive: true });
        fs.writeFileSync(path.resolve(overworldFolder, waypointFile), waypointDataToText(overworld));
        fs.writeFileSync(path.resolve(netherFolder, waypointFile), waypointDataToText(nether));
        fs.writeFileSync(path.resolve(endFolder, waypointFile), waypointDataToText(end));
        info('Finished converting waypoints message from discord into xaeros.');
    }
    let message;
    if (config.messageId)
        [message] = await client.fromApi(`GET /channels/${config.channelId}/messages`, {
            around: config.messageId,
            limit: 1
        }).catch(() => []);
    if (config.messageContentFragment)
        message = (await client.askFor('searchForIn', config.guildId, { content: config.messageContentFragment })) ?? message;
    if (!message)
        return info('Invalid message given to waypoint config, the required message could not be located by the content nor the messageId.');
    saveWaypointsFrom(message.content);
    client.on('MESSAGE_UPDATE', msg => {
        if (msg.id !== message.id) return;
        message = msg;
        saveWaypointsFrom(message.content);
    });
}