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
import { Roles } from '../src/api/stores/roles.js';
import { parseConfig } from './parse-config.js';
import nodes from './nodes';
import { createCanvas, loadImage } from 'canvas';
global.WebSocket = WebSocket;

function info(message) {
    console.log(message);
    notifier.notify({
        title: 'DiscordNT Node Server',
        message,
        icon: path.resolve(publicAsset, './icon.png')
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
const roles    = new Roles(client);    client.stores.push(roles);
fs.mkdirSync(usersFolder, { recursive: true });

process.on('exit', () => fs.rmSync(usersFolder, { recursive: true, force: true }));
users.on('set', async (id, old, user) => {
    const avatar = await loadImage(user.avatar
        ? Asset.UserAvatar(user, 'png', 64)
        : Asset.DefaultUserAvatar((+id.slice(6) % 6), 'png', 64)).catch(() => {});
    if (!avatar) return;
    const canvas = createCanvas(avatar.width, avatar.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'black';
    const top = [canvas.width / 2, 0];
    const radius = canvas.width / 2;
    const right = [canvas.width, canvas.height / 2];
    const bottom = [canvas.width / 2, canvas.height];
    const left = [0, canvas.height / 2];
    const topLeft = [0,0];
    const topRight = [canvas.width, 0];
    const bottomRight = [canvas.width, canvas.height];
    const bottomLeft = [0, canvas.height];
    ctx.beginPath();
    ctx.moveTo(...top);
    ctx.arcTo(...topRight, ...right, radius);
    ctx.arcTo(...bottomRight, ...bottom, radius);
    ctx.arcTo(...bottomLeft, ...left, radius);
    ctx.arcTo(...topLeft, ...top, radius);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(avatar, 0,0);
    fs.writeFileSync(path.resolve(usersFolder, `${id}.png`), canvas.toBuffer('image/png'));
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