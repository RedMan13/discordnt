import notifier from "node-notifier";

export const validSettings = { redirectUrl: 'string' };
export default function(config, client) {
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