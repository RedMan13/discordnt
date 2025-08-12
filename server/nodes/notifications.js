import notifier from "node-notifier";
import path from 'node:path';
import fs from 'node:fs';

export default function(config, client) {
    client.on('MESSAGE_CREATE', async message => {
        if (!await client.askFor('firesNotification', message)) return;
        console.log('Firing notification for message by', message.author.username);
        const channel = client.askFor('Channels.get', message.channel_id);
        const user = await client.askFor('getMember', channel?.guild_id, message.author.id);
        const pfp = path.resolve(config.pfpCache, `${message.author.id}.png`);
        const currentUser = client.askFor('Current.user_id');
        let content = message.content;
        let offset = 0;
        for (const match of content.matchAll(/<@!?([0-9]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            const user = await client.askFor('getUser', match[1]).catch(() => {});
            const insert = `@${user?.display_name ?? user?.username ?? match[1]}`;
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<@&([0-9]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            const role = client.askFor('Roles.get', match[1]);
            const insert = `@${role?.name ?? match[1]}`;
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<#([0-9]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            const channel = client.askFor('Channels.get', match[1]);
            const insert = `#${channel?.name ?? match[1]}`;
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<a?:([a-zA-Z_~0-9]+):([0-9]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            const insert = `:${match[1]}:`;
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<(\/[a-zA-Z0-9 ]+):([0-9]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            const insert = `${match[1]}`;
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<id:([a-z\-]+)>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            let insert = `${match[1]}`;
            switch (match[1]) {
            case 'customize': insert = '#Channels & Roles'; break;
            case 'browse': insert = '#Browse Channels'; break;
            case 'guide': insert = '#Server Guide'; break;
            case 'linked-roles': insert = '#Linked Roles'; break;
            }
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        offset = 0;
        for (const match of content.matchAll(/<t:(-?[0-9]+)(?::([tTdDfFR]))?>/g)) {
            const start = match.index + offset;
            const end = match[0].length + match.index + offset;
            let insert;
            const stamp = new Date(match[1] * 1000);
            switch (match[2]) {
            case 't':
                insert = stamp.toLocaleTimeString(undefined, { timeStyle: 'short' }); break;
            case 'T':
                insert = stamp.toLocaleTimeString(undefined, { timeStyle: 'medium' }); break;
            case 'd':
                insert = stamp.toLocaleDateString(undefined, { dateStyle: 'short' }); break;
            case 'D':
                insert = stamp.toLocaleDateString(undefined, { dateStyle: 'long' }); break;
            default:
            case 'f':
                insert = stamp.toLocaleDateString(undefined, { dateStyle: 'long' }) + ' at ' +
                    stamp.toLocaleTimeString(undefined, { timeStyle: 'short' });
                break;
            case 'F':
                insert = stamp.toLocaleDateString(undefined, { dateStyle: 'full' }) + ' at ' +
                    stamp.toLocaleTimeString(undefined, { timeStyle: 'short' });
                break;
            case 'R':
                const now = new Date();
                const years = stamp.getYear() - now.getYear();
                const ys = years > 1 ? 's' : '';
                const months = stamp.getMonth() - now.getMonth();
                const ns = years > 1 ? 's' : '';
                const days = stamp.getDate() - now.getDate();
                const ds = years > 1 ? 's' : '';
                const hours = stamp.getHours() - now.getHours();
                const hs = years > 1 ? 's' : '';
                const minutes = stamp.getMinutes() - now.getMinutes();
                const ms = years > 1 ? 's' : '';
                const seconds = stamp.getSeconds() - now.getSeconds();
                const ss = years > 1 ? 's' : '';
                insert = 'now';
                if (years !== 0)        insert = years >= 0   ? `in ${years} year${ys}`     :     `${Math.abs(years)} year${ys} ago`;
                else if (months !== 0)  insert = months >= 0  ? `in ${months} month${ns}`   :   `${Math.abs(months)} month${ns} ago`;
                else if (days !== 0)    insert = days >= 0    ? `in ${days} day${ds}`       :       `${Math.abs(days)} day${ds} ago`;
                else if (hours !== 0)   insert = hours >= 0   ? `in ${hours} hour${hs}`     :     `${Math.abs(hours)} hour${hs} ago`;
                else if (minutes !== 0) insert = minutes >= 0 ? `in ${minutes} minute${ms}` : `${Math.abs(minutes)} minute${ms} ago`;
                else if (seconds !== 0) insert = seconds >= 0 ? `in ${seconds} second${ss}` : `${Math.abs(seconds)} second${ss} ago`;
                break;
            }
            content = content.slice(0, start) + insert + content.slice(end);
            offset += insert - (end - start);
        }
        
        if (message.attachments?.length)
            content += ' ' + message.attachments.map(attach => attach.filename).join(', ');
        if (message.embeds?.length)
            content += ' ' + message.embeds.length + ' embeds';
        notifier.notify({
            title: (channel?.guild_id ?? currentUser) === currentUser 
                ? `${user.username} sent you a message`
                : `${user.username} mentioned you in ${channel.name}`,
            message: content,
            icon: pfp,
            open: config.redirectUrl
                .replaceAll('{guild_id}', channel?.guild_id ?? '@me')
                .replaceAll('{channel_id}', message.channel_id)
                .replaceAll('{message_id}', message.id),
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