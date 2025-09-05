import { WebSocketExpress } from "websocket-express";
import ERLP from 'erlpack';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { RPCCloseCodes, RPCIPCOpcodes } from "../../../src/api/type-enums";
import { CDNHost } from "../../../src/api/asset-helper";

export const managerConfig = {
    cdn_host: CDNHost,
    api_endpoint: '',
    enviroment: 'develop'
};
export const encodings = {
    'json': {
        encode(packet) { return Buffer.from(JSON.stringify(packet)) },
        decode(data) { return JSON.parse(data.toString('utf8')) }
    },
    'etf': {
        encode(packet) { return ERLP.pack(packet) },
        decode(data) { return ERLP.unpack(data) }
    }
};
export const versions = { '1': require('./v1') };
/** @type {IRPCApi[]} */
const connections = [];
/**
 * @param {import('../../../src/api/index')} client 
 * @param {'json'|'etf'} encoding 
 * @param {'1'} version 
 * @param {string} clientId 
 * @returns {object|number}
 */
export async function createConnection(client, encoding, version, clientId, rules) {
    console.log('creating RPC client')
    if (!(version in versions)) return [RPCCloseCodes.InvalidVersion];
    if (!(encoding in encodings)) return [RPCCloseCodes.InvalidEncoding];
    const appData = await client.fromApi(`GET /oauth2/applications/${clientId}/rpc`).catch(() => {});
    if (!appData) return [RPCCloseCodes.InvalidClientID];
    
    /** @type {IRPCApi} */
    const manager = new versions[version](client, clientId, managerConfig, appData);
    // gar gant
    for (const permission in manager.permissions) {
        manager.permissions[permission] = Array.isArray(rules.permissions[permission])
            ? rules.permissions[permission].includes(clientId)
            : rules.permissions[permission] === 'no'
                ? true
                : rules.permissions[permission] === 'yes'
                    ? false
                    : rules.permissions[permission] === 'whitelist-only'
                        ? !rules.whitelistedApplicationIds.includes(clientId)
                        : rules.permission[permission] === 'blacklist-only'
                            ? !rules.blacklistedApplicationIds.includes(clientId)
                            : false;
        if (!permission.startsWith('when')) {
            const val = !rules.ignoreRequests.includes(permission);
            switch (permission) {
            case 'readGuilds':
                manager.throwsBlocked['GET_GUILD'] = val;
                manager.throwsBlocked['GET_GUILDS'] = val;
                break;
            case 'readChannels':
                manager.throwsBlocked['GET_CHANNEL'] = val;
                manager.throwsBlocked['GET_CHANNELS'] = val;
                break;
            case 'joinVoiceChannels': manager.throwsBlocked['SELECT_VOICE_CHANNEL'] = val; break;
            case 'readVoiceChannels': manager.throwsBlocked['GET_SELECTED_VOICE_CHANNEL'] = val; break;
            case 'readVoiceSettings': manager.throwsBlocked['GET_VOICE_SETTINGS'] = val; break;
            case 'writeVoiceSettings': manager.throwsBlocked['SET_VOICE_SETTINGS'] = val; break;
            case 'changeOthersVoiceSettings': manager.throwsBlocked['SET_USER_VOICE_SETTINGS'] = val; break;
            case 'addHardwareMetadata': manager.throwsBlocked['SET_CERTIFIED_DEVICES'] = val; break;
            case 'writeActivityState': manager.throwsBlocked['SET_ACTIVITY'] = val; break;
            case 'acceptActivityInvites': manager.throwsBlocked['SEND_ACTIVITY_JOIN_INVITE'] = val; break;
            case 'rejectActivityInvites': manager.throwsBlocked['CLOSE_ACTIVITY_REQUEST'] = val; break;
            }
        }
    }
    connections.push(manager);
    console.log('created RPC client')
    return [encodings[encoding].encode({
        cmd: 'DISPATCH', 
        data: {
            v: version,
            config: managerConfig,
            user: client.askFor('Current.user')
        },
        evt: 'READY'
    }), manager];
}

export const maxPipeId = 10;
export const portRange = [6463, 6472];
export default function(config, client, info) {
    /** @type {import('websocket-express').ExtendedWebSocket} */
    const allSockets = [];
    const app = new WebSocketExpress();
    let port = portRange[0];
    function huntPorts(err) {
        switch (err?.code) {
        case null:
        case undefined:
            break;
        case 'EADDRINUSE':
            // try to next port in the sequence if this port failed, keep doing this till portRange[1]
            if (++port < portRange[1]) {
                try { app.listen(port); } catch (err) { huntPorts(err); }
                managerConfig.api_endpoint = `http://localhost:${port}`;
                break;
            }
        default: throw err;
        }
    }
    try { app.listen(port); } catch (err) { huntPorts(err); }
    managerConfig.api_endpoint = `http://localhost:${port}/api`;
    app.get('/auth', (req, res) => {
        const managers = connections.filter(manager => manager.authNonce === req.query.state);
        if (managers.length <= 0) {
            res.status(404);
            res.send('<h1>EBADSTATE: State nonce wasnt requested or has already been handled.</h1>');
            return;
        }
        res.send('<script>window.close()</script>');
        managers.forEach(manager => {
            const { rejectAuth, acceptAuth } = manager;
            manager.authNonce = null;
            manager.acceptAuth = null;
            manager.rejectAuth = null;
            if (req.query.error) return rejectAuth(req.query.error);
            acceptAuth(req.query.code);
        });
    });
    app.ws('/', async (req, res) => {
        console.log('recieved WebSocket RPC request');
        const { encoding = 'json', v: version, client_id } = req.query;
        const [out, connection] = await createConnection(encoding, version, client_id, config);
        if (typeof out === 'number') {
            console.log(`rejected RPC connection for ${RPCCloseCodes[out]}`);
            return res.reject(out);
        }
        const sock = await res.accept();
        sock.binaryType = 'nodebuffer';
        connection.on('send', packet => sock.send(encodings[encoding].encode(packet)));
        sock.onmessage = async e => {
            const packet = encodings[encoding].decode(e.data);
            const res = await connection.execute(packet);
            if (!res) return;
            sock.send(encodings[encoding].encode(res));
        };
    });
    
    /** @type {net.Socket} */
    const allClients = [];
    const pipe = net.createServer();
    let pipeId = 0;
    function getPipePath() {
        if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${pipeId}`;
        const {
            env: { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP }
        } = process;

        const prefix = fs.realpathSync(XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? `${path.sep}tmp`);
        return path.join(prefix, `discord-ipc-${pipeId}`);
    }
    pipe.on('error', err => {
        switch (err?.code) {
        case null:
        case undefined:
            break;
        case 'EADDRINUSE':
            if (pipeId < maxPipeId) {
                pipeId++; // try to next port in the sequence if this port failed, keep doing this till maxPipeId
                pipe.listen(getPipePath());
                break;
            }
        default: throw err;
        }
    });
    pipe.on('connection', sock => {
        console.log('recieved IPC RPC request');
        /** @type {IRPCApi} */
        let connection;
        let encoding = 'json'
        function send(op, data) {
            const buf = Buffer.alloc(data.length +8);
            buf.writeUInt32LE(op, 0);
            buf.writeUInt32LE(data.length, 4);
            data.copy(buf, 8, 0, data.length);
            sock.write(buf);
        }
        sock.on('data', async data => {
            const op = data.readUInt32LE(0);
            const len = data.readUInt32LE(4);
            const str = data.subarray(8, len +8);
            if (str.length !== len) return;
            const packet = encodings[encoding].decode(str);
            switch (op) {
            case RPCIPCOpcodes.HANDSHAKE:
                const [out, connect] = await createConnection(client, packet.encoding ?? encoding, packet.v, packet.client_id, config);
                if (typeof out === 'number') {
                    console.log(`rejected RPC connection for ${RPCCloseCodes[out]}`);
                    send(RPCIPCOpcodes.CLOSE, encodings[encoding].encode(out));
                    sock.end();
                    return;
                }
                if (packet.encoding) encoding = packet.encoding;
                connection = connect;
                connection.on('send', packet => 
                    send(RPCIPCOpcodes.FRAME, encodings[encoding].encode(packet)));
                send(RPCIPCOpcodes.FRAME, out);
                break;
            case RPCIPCOpcodes.FRAME: 
                const res = await connection.execute(packet);
                if (!res) return;
                send(RPCIPCOpcodes.FRAME, encodings[encoding].encode(res));
                break;
            case RPCIPCOpcodes.PING:
                send(RPCIPCOpcodes.PONG, encodings[encoding].encode(packet));
                break;
            case RPCIPCOpcodes.CLOSE: sock.end(); break;
            }
        });
    });
    pipe.listen(getPipePath());

    process.on('beforeExit', () => {
        pipe.close();
        allClients.forEach(
            /** @param {net.Socket} client */
            client => client.destroy()
        );
        allSockets.forEach(
            /** @param {import('websocket-express').ExtendedWebSocket} sock */
            sock => sock.close()
        );
    });
}