#!/usr/bin/env node
import * as fs from 'node:fs';  
import * as path from 'node:path';  
import notifier from 'node-notifier';  
import WebSocket from 'ws';  
import { Asset } from '../src/api/asset-helper.js';  
import ApiInterface from "../src/api/index.js";  
import { Users } from "../src/api/stores/users.js";  
import { Channels } from "../src/api/stores/channels.js";  
import { Guilds } from "../src/api/stores/guilds.js";  
import { Current } from "../src/api/stores/current.js";  
import { Members } from "../src/api/stores/members.js";  
import { WebSocketExpress } from 'websocket-express';
import YAML from 'yaml';
global.WebSocket = WebSocket;
const conf = path.resolve('./config.yml');
const usersFolder = path.resolve('./users');
function loadConfig(defaults) {
    const parse = fs.existsSync(conf) 
        ? YAML.parse(fs.readFileSync(conf)) 
        : defaults;
    ;
}

if (Date.now() - parse.lastUpdateFetch > (7 * 24 * 60 * 60 * 1000))
    fetch('https://godslayerakp.serv00.net/discordnt-server/appver.txt')
        .then(req => req.text())
        .then(version => {
            parse.version ??= version;
            parse.lastUpdateFetch = Date.now();
            fs.writeFileSync(conf, JSON.stringify(parse, null, 4));
            if (parse.version !== version) {
                notifier.notify({
                    title: 'DiscordNT Node Server',
                    message: 'New app version released! please check the website or more info and downloads.',
                    open: 'https://godslayerakp.serv00.net/discordnt-server',
                    icon: path.resolve('./default.png')
                });
            }
        });
function parseWaypointData(string) {
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
function waypointDataToText(data) {
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
const waypointFile = parse.waypoint.worldId + '.txt';
const overworldFolder = path.resolve(parse.waypoint.directory, 'dim%0');
const netherFolder = path.resolve(parse.waypoint.directory, 'dim%-1');
const endFolder = path.resolve(parse.waypoint.directory, 'dim%1');
function saveWaypointsFrom(string) {
    const { overworld, nether, end } = parseWaypointData(string);
    fs.mkdirSync(overworldFolder, { recursive: true });
    fs.mkdirSync(netherFolder, { recursive: true });
    fs.mkdirSync(endFolder, { recursive: true });
    fs.writeFileSync(path.resolve(overworldFolder, waypointFile), waypointDataToText(overworld));
    fs.writeFileSync(path.resolve(netherFolder, waypointFile), waypointDataToText(nether));
    fs.writeFileSync(path.resolve(endFolder, waypointFile), waypointDataToText(end));
    notifier.notify({
        title: 'DiscordNT Node Server',
        message: 'Finished converting waypoints message from discord into xaeros.',
        icon: path.resolve('./default.png')
    });
}

const client = new ApiInterface(parse.token, 9);
const current  = new Current(client);  client.stores.push(current);
const guilds   = new Guilds(client);   client.stores.push(guilds);
const channels = new Channels(client); client.stores.push(channels);
const users    = new Users(client);    client.stores.push(users);
const members  = new Members(client);  client.stores.push(members);
if (fs.existsSync(usersFolder)) fs.rmSync(usersFolder, { recursive: true, force: true });
fs.mkdirSync(usersFolder);

process.on('exit', () => fs.rmSync(usersFolder, { recursive: true, force: true }));
users.on('set', async (id, old, user) => {
    const req = await fetch(Asset.UserAvatar(user, 'png', 64));
    const res = await req.arrayBuffer();
    fs.writeFileSync(path.resolve(usersFolder, `${id}.png`), Buffer.from(res));
});
users.on('remove', id => fs.rm(path.resolve(usersFolder, `${id}.png`)));
client.on('open', () => {
    notifier.notify({
        title: 'DiscordNT Node Server',
        message: 'Connecting to the discord gateway.',
        icon: path.resolve('./default.png')
    });
})
client.on('invalid', () => {
    notifier.notify({
        title: 'DiscordNT Node Server',
        message: 'Couldnt connect to the discord gateway. Closing server.',
        icon: path.resolve('./default.png')
    });
    process.exit();
});
client.on('READY', () => {
    notifier.notify({
        title: 'DiscordNT Node Server',
        message: 'Successfully connected to the discord gateway.',
        icon: path.resolve('./default.png')
    });

    if (parse.waypoint.enabled) (async () => {
        notifier.notify({
            title: 'DiscordNT Node Server',
            message: 'Loading waypoints message from discord into xaeros.',
            icon: path.resolve('./default.png')
        });
        if (!fs.existsSync(parse.waypoint.directory))
            return notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Invalid directory given to waypoint config, the given directory must actually exist inside the file system.',
                icon: path.resolve('./default.png')
            });
        if (!parse.waypoint.messageId && !parse.waypoint.title)
            return notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Invalid messageId/title given to waypoint config, one of these properties must exist and must actually point to real messages.',
                icon: path.resolve('./default.png')
            });
        if (parse.waypoint.messageId && !channels.get(parse.waypoint.channelId)) 
            return notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Invalid channelId given to waypoint config, channelId must refer to a real channel if messageId is set.',
                icon: path.resolve('./default.png')
            });
        if (parse.waypoint.title && !guilds.get(parse.waypoint.guildId))
            return notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Invalid guildId given to waypoint config, guildId must refer to a real guild if title is set.',
                icon: path.resolve('./default.png')
            });
        let message;
        if (parse.waypoint.messageId)
            [message] = await client.fromApi(`GET /channels/${parse.waypoint.channelId}/messages`, {
                around: parse.waypoint.messageId,
                limit: 1
            }).catch(() => []);
        if (parse.waypoint.title)
            message = (await guilds.searchForIn(parse.waypoint.guildId, { content: parse.waypoint.title })) ?? message;
        if (!message)
            return notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Invalid message given to waypoint config, the required message could not be located by the title or the messageId.',
                icon: path.resolve('./default.png')
            });
        
        notifier.notify({
            title: 'DiscordNT Node Server',
            message: 'Converting waypoints message from discord into xaeros.',
            icon: path.resolve('./default.png')
        });
        saveWaypointsFrom(message.content);
        client.on('MESSAGE_UPDATE', msg => {
            if (msg.id !== message.id) return;
            message = msg;
            notifier.notify({
                title: 'DiscordNT Node Server',
                message: 'Converting waypoints message from discord into xaeros.',
                icon: path.resolve('./default.png')
            });
            saveWaypointsFrom(message.content);
        });
    })();
});
if (parse.notifications) {
    client.on('MESSAGE_CREATE', async message => {
        if (!await current.firesNotification(message)) return;
        console.log('Firing notification for message by', message.author.username);
        const channel = channels.get(message.channel_id);
        const user = await members.getMember(channel?.guild_id, message.author.id);
        const pfp = path.resolve(usersFolder, `${message.author.id}.png`);
        notifier.notify({
            title: (channel?.guild_id ?? current.user_id) === current.user_id 
                ? `${user.username} sent you a message`
                : `${user.username} mentioned you in ${channel.name}`,
            message: message.content + 
                (message.message_reference?.type === 0 
                    ? `\n( in reply to "${message.referenced_message.content}" )` 
                    : ''),
            icon: fs.existsSync(pfp) 
                ? pfp
                : path.resolve('./default.png'),
            open: parse.url
                .replaceAll('guild_id', channel?.guild_id ?? '@me')
                .replaceAll('channel_id', message.channel_id)
                .replaceAll('message_id', message.id),
            reply: true
        }, (err, res, meta) => {
            if (err) throw err;
            if (!meta) return;
            if (meta.activationType !== 'replied') return;
            client.fromApi(`POST /channels/${message.channel_id}/messages`, {
                content: res,
                message_reference: {
                    message_id: message.id,
                    fail_if_not_exists: false
                }
            })
        });
    });
}