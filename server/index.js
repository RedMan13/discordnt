#!/usr/bin/env node

import * as path from 'node:path';  
global.publicAsset = /node(\.exe)?$/.test(process.argv0)
    ? process.cwd()
    : path.resolve(process.argv0, '..');

import * as fs from 'node:fs';  
import notifier from 'node-notifier';  
import WebSocket from 'ws';  
import { Asset } from '../src/api/asset-helper.js';  
import ApiInterface from "../src/api/index.js";  
import { Users } from "../src/api/stores/users.js";  
import { Channels } from "../src/api/stores/channels.js";  
import { Guilds } from "../src/api/stores/guilds.js";  
import { Current } from "../src/api/stores/current.js";  
import { Members } from "../src/api/stores/members.js";  
import { parseConfig } from './parse-config.js';
import nodes from './nodes';
global.WebSocket = WebSocket;

function info(message) {
    console.log(message);
    notifier.notify({
        title: 'DiscordNT Node Server',
        message,
        icon: path.resolve(publicAsset, './default.png')
    });
}
/* no real reason for this is there
const myVersion = fs.readFileSync(path.resolve(__dirname, '../appver.txt'), 'utf8');
fetch('https://raw.githubusercontent.com/RedMan13/discordnt/refs/heads/main/appver.txt')
    .then(req => req.text())
    .then(version => {
        if (myVersion !== version)
            info('New app version released! please check the website for more info and downloads.');
    })
    .catch(() => {});
*/
const config = parseConfig();
const usersFolder = path.resolve('./users');

const client = new ApiInterface(config.token, 9);
const current  = new Current(client);  client.stores.push(current);
const guilds   = new Guilds(client);   client.stores.push(guilds);
const channels = new Channels(client); client.stores.push(channels);
const users    = new Users(client);    client.stores.push(users);
const members  = new Members(client);  client.stores.push(members);
fs.mkdirSync(usersFolder, { recursive: true });

process.on('exit', () => fs.rmSync(usersFolder, { recursive: true, force: true }));
users.on('set', async (id, old, user) => {
    const req = await fetch(Asset.UserAvatar(user, 'png', 64));
    const res = await req.arrayBuffer();
    fs.writeFileSync(path.resolve(usersFolder, `${id}.png`), Buffer.from(res));
});
users.on('remove', id => fs.rm(path.resolve(usersFolder, `${id}.png`)));
client.on('open', () => {
    info('Connecting to the discord gateway.');
});
client.on('invalid', () => {
    info('Couldnt connect to the discord gateway. Closing server.');
    process.exit();
});
client.on('READY', async () => {
    info('Successfully connected to the discord gateway.');

    const onStartup = {};
    for (const file in nodes) {
        const { name } = path.parse(file);
        const node = nodes[name];
        onStartup[name] = node;
    }
    for (const [name, func] of Object.entries(onStartup)) {
        if (String(config[name].enabled).match(/^[nf]/i)) continue;
        func(config[name], client, info);
    }
});