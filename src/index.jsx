import Long from "long"; // import to ensure existence in node modules
import ApiInterface from "./api/index.js";
import { Messages } from "./api/stores/messages.js";
import { Users } from "./api/stores/users.js";
import { Channels } from "./api/stores/channels.js";
import { Guilds } from "./api/stores/guilds.js";
import { Current } from "./api/stores/current.js";
import { Roles } from "./api/stores/roles.js";
import { Members } from "./api/stores/members.js";
import { GatewayOpcode } from './api/type-enums.js';
labelLoadingStage('Connecting client to server.');
window.client = new ApiInterface(parse['Token'], 9);
client.on('open', () => labelLoadingStage('Connected to discords gateway'));
client.on('packet', ({ opcode }) => {
    switch (opcode) {
    case GatewayOpcode.Hello: 
        labelLoadingStage('Recieved discords Hello packet. Awaiting authorization'); 
        break;
    }
});
client.on('invalid', () => requireLogin());
const current  = new Current(client);  client.stores.push(current);
const channels = new Channels(client); client.stores.push(channels);
const users    = new Users(client);    client.stores.push(users);
const guilds   = new Guilds(client);   client.stores.push(guilds);
const roles    = new Roles(client);    client.stores.push(roles);
const members  = new Members(client);  client.stores.push(members);

import { DiscordMessage } from "./elements/message/elm.jsx";  
import { fillViewer } from './elements/guilds/gen.jsx';
import { MessageEditor } from './elements/message-writer/elm.jsx';

const main = document.getElementById('main');
main.style.display = 'grid';
main.style.gridTemplateRows = 'minmax(auto, 1fr) auto';
main.style.height = "100%";
const wrapper = <div style="
    display: flex; 
    flex-direction: column-reverse; 
    height: 100%; 
    overflow-x: hidden; 
    overflow-y: scroll;
"></div>;
main.appendChild(wrapper);
main.appendChild(<MessageEditor></MessageEditor>);
const root = <div></div>;
wrapper.appendChild(root);
client.on('READY', () => {
    fillViewer();
    enableBrowser();

    const messages = new Messages(client); client.stores.push(messages);
    labelLoadingStage('Authorized by discord. Fetching channel messages.');
    messages.on('loaded', () => {
        finishLoading();
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