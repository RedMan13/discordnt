import Long from "long"; // import to ensure existence in node modules
import ApiInterface from "./api/index.js";
import { Messages } from "./api/stores/messages.js";
import { Users } from "./api/stores/users.js";
import { Channels } from "./api/stores/channels.js";
import { Guilds } from "./api/stores/guilds.js";
import { Current } from "./api/stores/current.js";
import { Roles } from "./api/stores/roles.js";
import { Members } from "./api/stores/members.js";
window.client = new ApiInterface();
const current  = new Current(client);  client.stores.push(current);
const channels = new Channels(client); client.stores.push(channels);
const users    = new Users(client);    client.stores.push(users);
const guilds   = new Guilds(client);   client.stores.push(guilds);
const roles    = new Roles(client);    client.stores.push(roles);
const members  = new Members(client);  client.stores.push(members);

import { DiscordMessage } from "./elements/message/elm.jsx";  
import { fillViewer } from './elements/guilds/gen.jsx';

const main = document.getElementById('main');
main.style.display = 'flex';
main.style.flexDirection = 'column-reverse';
main.style.height = '100%';
main.style.overflowX = 'hidden';
main.style.overflowY = 'scroll';
const root = <div></div>
main.appendChild(root);
client.on('READY', () => {
    fillViewer();
    enableBrowser();

    const messages = new Messages(client); client.stores.push(messages);
    messages.on('loaded', () => {
        const msgId = messages.center;
        if (!msgId) return;
        const msg = document.getElementById(msgId);
        msg.scrollIntoView();
    })
    messages.on('push', id => {
        const msg = <DiscordMessage id={id}></DiscordMessage>;
        root.append(msg);
    });
    messages.on('insert', (idx, id) => {
        const insert = root.children[idx -1];
        if (!insert) {
            root.prepend(<DiscordMessage id={id}></DiscordMessage>);
            return;
        }
        insert.after(<DiscordMessage id={id}></DiscordMessage>);
    });
    messages.on('move', (id, oldIdx, newIdx) => {
        const msg = document.getElementById(id);
        if (!msg) return;
        msg.remove();
        const insert = root.children[newIdx -1];
        if (!insert) {
            root.prepend(msg);
            return;
        }
        insert.after(msg);
    })
    messages.on('delete', id => {
        const msg = document.getElementById(id);
        if (!msg) return;
        const nextMsg = msg.nextSibling;
        msg.remove();
        nextMsg.render();
    });
    messages.on('bulkDelete', (ids, start, end) => {
        ids.forEach(id => {
            const msg = document.getElementById(id);
            if (!msg) return;
            msg.remove();
        });
        const msg = root.children[start];
        if (!msg) return;
        msg.render();
    })
    messages.on('clear', () => root.innerHTML = '');
});