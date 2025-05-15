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
        notifier.notify({
            title: (channel?.guild_id ?? currentUser) === currentUser 
                ? `${user.username} sent you a message`
                : `${user.username} mentioned you in ${channel.name}`,
            message: message.content + 
                (message.message_reference?.type === 0 
                    ? `\n( in reply to "${message.referenced_message.content}" )` 
                    : ''),
            icon: fs.existsSync(pfp) 
                ? pfp
                : path.resolve('./default.png'),
            open: config.redirectUrl
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