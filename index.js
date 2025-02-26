#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import notifier from 'node-notifier';
import WebSocket from 'ws';
global.WebSocket = WebSocket;
const conf = path.resolve('./config.json');
const usersFolder = path.resolve('./users');
const parse = fs.existsSync(require.resolve(conf)) 
    ? JSON.parse(fs.readFileSync(conf)) 
    : {};
parse.url ??= 'https://godslayerakp.serv00.net/discordnt.html';
parse.token ??= process.argv[2];
fs.writeFileSync(conf, JSON.stringify(parse, null, 4))
import { Asset } from './src/api/asset-helper.js';
import ApiInterface from "./src/api/index.js";
import { Users } from "./src/api/stores/users.js";
import { Channels } from "./src/api/stores/channels.js";
import { Guilds } from "./src/api/stores/guilds.js";
import { Current } from "./src/api/stores/current.js";
import { Members } from "./src/api/stores/members.js";
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
});
client.on('MESSAGE_CREATE', async message => {
    if (!await current.firesNotification(message)) return;
    console.log('Firing notification for message by', message.author.username);
    const channel = channels.get(message.channel_id);
    const user = await members.getMember(channel.guild_id, message.author.id);
    const pfp = path.resolve(usersFolder, `${message.author.id}.png`);
    notifier.notify({
        title: channel.guild_id === current.user_id 
            ? `${user.username} sent you a message`
            : `${user.username} mentioned you in ${channel.name}`,
        message: (message.message_reference?.type === 0 
            ? `( ${message.referenced_message.content} )\n` 
            : '') + 
            message.content,
        icon: fs.existsSync(pfp) 
            ? pfp
            : path.resolve('./default.png'),
        open: `${parse.url}#${message.channel_id}`,
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