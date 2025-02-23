#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const notifier = require('node-notifier');
const parse = fs.existsSync('./config.json') ? JSON.parse(fs.readFileSync('./config.json')) : {};
parse.url ??= 'https://godslayerakp.serv00.net/discordnt.html';
const { Asset } = require('./src/api/asset-helper');
const ApiInterface = require('./src/api/index.js');
const { Current } = require('./src/api/stores/current');
const { Channels } = require('./src/api/stores/channels');
const { Users } = require('./src/api/stores/users');
const { Members } = require('./src/api/stores/members');
const client = new ApiInterface(parse.token, 9);
const current  = new Current(client);  client.stores.push(current);
const channels = new Channels(client); client.stores.push(channels);
const users    = new Users(client);    client.stores.push(users);
const members  = new Members(client);  client.stores.push(members);
fs.mkdir('./users');

process.on('exit', () => fs.rmSync('./users', { recursive: true, force: true }));
users.on('set', async (id, old, user) => {
    const req = await fetch(Asset.UserAvatar(user, 'png', 64));
    const res = await req.arrayBuffer();
    fs.writeFile(`./users/${id}.png`, res);
});
users.on('remove', id => fs.rm(`./users/${id}.png`));
client.on('MESSAGE_CREATE', async message => {
    if (!await current.firesNotification(message)) return;
    const channel = channels.get(message.channel_id);
    const user = await members.getMember(channel.guild_id, message.author.id);
    notifier.notify({
        title: `${user.username} mentioned you in ${channel.name}`,
        message: (message.message_reference?.type === 0 
            ? `( ${message.referenced_message.content} )\n` 
            : '') + 
            message.content,
        icon: path.resolve(`./users/${id}.png`),
        open: `${parse.url}#${message.channel_id}`,
        reply: true
    }, (err, res, meta) => {
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