import { Inflate } from 'pako';
import { GatewayOpcode } from './type-enums.js';
import { EventSource } from './event-source.js';
// note: this is reversed to how it should actually be shaped
const ZLIB_SUFFIX = new Uint8Array([255, 255, 0, 0]);
const gateway = 'wss://gateway.discord.gg';

export default class ApiInterface extends EventSource {
    constructor(token, version = 9) {
        super();
        this.mustAuthImediat = false;
        this.reconUrl = gateway;
        this.sessionId = null;
        this.token = token ?? localStorage.token;
        this.version = version;
        this.stores = [];

        this.msgBuf = new Uint8Array();
        this.infContext = new Inflate({
            to: 'string',
            chunkSize: 0xFFFFFF
        });
        this.infContext.onData = txt => {
            let json;
            try {
                json = JSON.parse(txt);
            } catch (err) {
                console.log('invalid json', txt, err);
            }
            if (json) this.onpacket(json);
        }
        const url = new URL(gateway);
        url.searchParams.set('v', this.version);
        url.searchParams.set('encoding', 'json');
        url.searchParams.set('compress', 'zlib-stream');
        this.websocket = new WebSocket(url);
        this.websocket.binaryType = "arraybuffer";
        this.websocket.onopen = this.onopen.bind(this);
        this.websocket.onmessage = this.onmessage.bind(this);
        this.websocket.onerror = this.onerror.bind(this);
        this.websocket.onclose = this.onclose.bind(this);

        this.apiReqs = {};
    }

    fromApi(callPath, body) {
        if (this.apiReqs[callPath]) return this.apiReqs[callPath];
        const [method, path] = callPath.split(' ', 2);
        const url = new URL(`https://discord.com/api/v${this.version}${path}`);
        console.log(method, 'at', url.toString());
        const opts = {
            method,
            headers: {
                'Authorization': this.token,
                'Content-Type': 'application/json'
            }
        }
        if (method === 'GET' && body) {
            for (const [key, value] of Object.entries(body)) {
                url.searchParams.set(key, value);
            }
        } else {
            opts.body = JSON.stringify(body);
        }

        const promise = fetch(url, opts)
            .then(req => req.json())
            .then(res => {
                delete this.apiReqs[url];
                if ('code' in res) return Promise.reject(res);
                return res;
            })
            .catch(message => Promise.reject({ message }));
        this.apiReqs[url] = promise
        return promise;
    }
    askFor(key, ...args) {
        const parts = key.split('.');
        const storeName = parts.length >= 2 ? parts[0] : null;
        key = parts[1] ?? parts[0];
        const store = this.stores.find(store => 
            (storeName ? Object.getPrototypeOf(store).constructor.name === storeName : true) &&
            typeof store[key] !== 'undefined');
        if (!store || !store[key]) return;
        if (typeof store[key] !== 'function') return store[key];
        return store[key].apply(store, args);
    }
    store(name) {
        return this.stores.find(store => Object.getPrototypeOf(store).constructor.name === name);
    }

    reconnect(useGateway, message) {
        console.warn('reconnecting because', message);
        this.mustAuthImediat = !useGateway;
        const reconUrl = useGateway
            ? gateway
            : this.reconUrl;
        this.websocket.close();
        const url = new URL(reconUrl);
        url.searchParams.set('v', this.version);
        url.searchParams.set('encoding', 'json');
        url.searchParams.set('compress', 'zlib-stream');
        this.websocket = new WebSocket(reconUrl);
        this.websocket.binaryType = "arraybuffer";
        this.websocket.onopen = this.onopen.bind(this);
        this.websocket.onmessage = this.onmessage.bind(this);
        this.websocket.onerror = this.onerror.bind(this);
        this.websocket.onclose = this.onclose.bind(this);
    }
    onopen() {
        if (this.mustAuthImediat) {
            // always unset because this is for an explicit task that can not be reiterated elsewhen
            this.mustAuthImediat = false;
            this.send(6, {
                token: this.token,
                session_id: this.sessionId,
                seq: this.seq
            });
        }
    }
    onmessage(e) {
        const data = new Uint8Array(e.data);
        const msgBuf = this.msgBuf;
        this.msgBuf = new Uint8Array(msgBuf.length + data.length);
        this.msgBuf.set(msgBuf);
        this.msgBuf.set(data, msgBuf.length);
        const isEnd = ZLIB_SUFFIX.every((v, i) => data[data.length - (i +1)] === v);
        if (isEnd) {
            this.infContext.push(this.msgBuf, 2);
            this.msgBuf = new Uint8Array();
        }
    }
    onpacket({ op: opcode, d: data, s: seq, t: event }) {
        if (seq) this.seq = seq;
        if (event) return this.onevent(event, data);
        console.log('gateway op:', GatewayOpcode[opcode] ?? opcode, 'd:', data, 's:', seq, 't:', event);
        switch (opcode) {
        case GatewayOpcode.Heartbeat:
            this.send(11);
            break;
        case GatewayOpcode.Reconnect:
            this.reconnect(false, 'server requested reconnect');
            break;
        case GatewayOpcode.InvalidSession:
            this.reconnect(true, 'invalid session');
            break;
        case GatewayOpcode.Hello:
            this.heart = setInterval(() => {
                if (this.waitingResponse) return this.reconnect(false, 'no pong to our ping')
                this.send(1, this.seq)
            }, data.heartbeat_interval);
            this.send(2, {
                "token": this.token,
                "capabilities": 16381,
                "properties": {
                    "os": "Win32",
                    "browser": "Mozilla",
                    "device": "",
                    "system_locale": navigator.language,
                    "browser_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
                    "browser_version": "5.0",
                    "os_version": "21.0.0",
                    "referrer": "",
                    "referring_domain": "",
                    "referrer_current": "",
                    "referring_domain_current": "",
                    "release_channel": "stable",
                    "client_build_number": 291963,
                    "client_event_source": null,
                    "design_id": 0
                },
                "presence": {
                    "status": "online",
                    "since": 0,
                    "activities": [],
                    "afk": false
                },
                "compress": false,
                "client_state": {
                    "guild_versions": {}
                }
            });
            break;
        case GatewayOpcode.HeartbeatACK:
            this.waitingResponse = false;
            break;
        }
    }
    async onevent(event, data) {
        this.stores.forEach(store => {
            if (store.listens.includes(event))
                store.notify(event, data);
        });
        this.emit(event, data);
    }
    onerror() {
        this.reconnect(false, 'websocket errored');
    }
    onclose() {
        clearInterval(this.heart);
    }

    send(opcode, data) {
        console.log('gateway op:', GatewayOpcode[opcode] ?? opcode, 'd:', data);
        const obj = {
            op: opcode,
            d: data
        };
        this.websocket.send(JSON.stringify(obj));
    }
}