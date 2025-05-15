import { WebSocketExpress } from "websocket-express";
import ERLP from 'erlpack';
import { RPCCloseCodes } from "../../../src/api/type-enums";
import { CDNHost } from "../../../src/api/asset-helper";

/**
 * @typedef {Object} IRPCApi
 * @prop {string} clientId
 * @prop {ApiInterface} client
 * @prop {{ [key: string]: { [key: string]: boolean } | boolean }} subscriptions
 * @prop {{ cdn_url: string, api_endpoint: string, enviroment: string }} config
 * @prop {string} authNonce
 * @prop {(code: string) => void} acceptAuth
 * @prop {(code: string) => void} rejectAuth
 * @prop {(cmd: string, args: any, evt?: string) => Promise<any>}  execute
 */
export const managerConfig = {
    cdn_host: CDNHost,
    api_endpoint: '',
    enviroment: 'develop'
};
export const portRange = [6463, 6472];
export const encodings = ['json', 'etf'];
export const versions = { '1': require('./v1') };
export default function(config, client, info) {
    const app = new WebSocketExpress();
    let port = portRange[0];
    function huntPorts(err) {
        switch (err?.code) {
        case null:
        case undefined:
            break;
        case 'EADDRINUSE':
            if (port < portRange[1]) {
                port++; // try to next port in the sequence if this port failed, keep doing this till portRange[1]
                app.listen(port, huntPorts);
                managerConfig.api_endpoint = `http://localhost:${port}`;
                break;
            }
        default: throw err;
        }
    }
    app.listen(port, huntPorts);
    managerConfig.api_endpoint = `http://localhost:${port}/api`;

    /** @type {IRPCApi[]} */
    const connections = [];
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
    })
    app.ws('/', async (req, res) => {
        if (!(req.query.version in versions)) res.reject(RPCCloseCodes.InvalidVersion);
        if (!(encodings.includes(req.query.encoding))) res.reject(RPCCloseCodes.InvalidEncoding);
        const sock = await res.accept();
        const appData = await client.fromApi(`GET /oauth2/applications/${req.query.client_id}/rpc`).catch(() => {});
        if (!appData) sock.close(RPCCloseCodes.InvalidClientID);
        
        /** @type {IRPCApi} */
        const manager = new versions[req.query.version](client, req.query.client_id, config, appData);
        connections.push(manager);
        switch (req.query.encoding) {
        case 'json': {
            sock.onmessage = e => {
                const packet = JSON.parse(e.data);
                sock.send(JSON.stringify({
                    cmd: packet.cmd,
                    nonce: packet.nonce,
                    data: manager.execute(packet.cmd, packet.args, packet.evt)
                }));
            }
            sock.send(JSON.stringify({
                cmd: 'DISPATCH', 
                data: {
                    v: req.query.version,
                    config,
                    user: client.askFor('Current.user')
                },
                evt: 'READY'
            }));
            break;
        }
        case 'etf': {
            sock.binaryType = 'arraybuffer';
            sock.onmessage = e => {
                const packet = ERLP.unpack(e.data);
                sock.send(ERLP.pack({
                    cmd: packet.cmd,
                    nonce: packet.nonce,
                    data: manager.execute(packet.cmd, packet.args, packet.evt)
                }));
            }
            sock.send(ERLP.pack({
                cmd: 'DISPATCH', 
                data: {
                    v: req.query.version,
                    config,
                    user: client.askFor('Current.user')
                },
                evt: 'READY'
            }));
            break;
        }
        }
    });
}