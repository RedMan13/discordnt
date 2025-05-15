import { Inflate } from 'pako';
import { GatewayOpcode } from './type-enums.js';
import { EventSource } from './event-source.js';
const localStorage = globalThis.window?.localStorage ?? {};
// create a fake localStorage that filters out token
if (globalThis.window?.localStorage) {
    delete window.localStorage;
    window.localStorage = {
        get length() { return localStorage.length; },
        key(idx) { return localStorage.key(idx); },
        getItem(key) {
            key = `${key}`;
            if (key === 'token') return;
            return localStorage.get(key); 
        },
        setItem(key, value) {
            localStorage.setItem(key, value);
            if (!window.localStorage[key] && key !== 'token') {
                Object.defineProperty(window.localStorage, key, {
                    get() { return window.localStorage.getItem(key); },
                    set(value) { return window.localStorage.setItem(key, value); }
                });
            }
        },
        removeItem(key) { localStorage.removeItem(key); },
        clear() { localStorage.clear(); }
    };
    const keys = new Array(localStorage.length).fill('').map((_, i) => localStorage.key(i));
    for (const key of keys) {
        if (key === 'token') continue;
        Object.defineProperty(window.localStorage, key, {
            get() { return window.localStorage.getItem(key); },
            set(value) { return window.localStorage.setItem(key, value); }
        });
    }
}
// note: this is reversed to how it should actually be shaped
const ZLIB_SUFFIX = new Uint8Array([255, 255, 0, 0]);
const gateway = 'wss://gateway.discord.gg';
export function stringifyError(packet, errors, indent = '') {
    if (errors.message) {
        if (!errors.errors) return `${errors.message} (${errors.code})`;
        let out = '';
        out += `// ${errors.message} (${errors.code})\n`;
        out += stringifyError(packet, errors.errors).join('\n');
        return out;
    }
    const lines = [];
    lines.push(Array.isArray(packet) ? '[' : '{');
    for (const key in packet) {
        const member = errors[key];
        if (member._errors)
            for (const { message, code } of member._errors) 
                lines.push(`    // ${message} (${code})`);
        switch (typeof packet[key]) {
        case 'object':
            if (packet[key] === null) { lines.push(`"${key}": null,`); break; }
            const child = stringifyError(packet[key], errors[key], indent + '    ');
            child[child.length -1] += ',';
            lines.push(...child);
            break;
        default:
        case 'boolean': 
        case 'bigint':
        case 'number':
        case 'string':
        case 'undefined':
            lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(packet[key])}`); break;
        }
    }
    lines[lines.length -1] = lines[lines.length -1].slice(0, -1);
    lines.push(Array.isArray(packet) ? ']' : '}');
    return lines.map((line, idx) => idx === 0 ? line : indent + line);
}        
  
export const DebuggerEvents = ['READY', 'READY_SUPPLIMENTAL'];
export default class ApiInterface extends EventSource {
    #token = null;
    constructor(token, version = 9) {
        super();
        this.mustAuthImmediate = false;
        this.reconUrl = gateway;
        this.sessionId = null;
        this.#token = token ?? localStorage.token;
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
        this.limitedApis = {};
        this.globalLimit = NaN;
        
    }
    get token() { return !!this.#token }
    set token(token) {
        this.#token = token;
        localStorage.token = token;
        this.reconnect(true, 'New Token');
    }

    fromApi(callPath, body) {
        if (this.apiReqs[callPath]) return this.apiReqs[callPath];
        const [method, path] = callPath.split(' ', 2);
        if (Date.now() < this.limitedApis[path]) return;
        if (Date.now() < this.globalLimit) return;
        delete this.limitedApis[path];
        this.globalLimit = NaN;
        const url = new URL(`https://discord.com/api/v${this.version}${path}`);
        console.log(method, 'at', url.toString());
        const opts = {
            method,
            headers: {
                'Authorization': this.#token,
                'Content-Type': 'application/json'
            }
        }
        if (method === 'GET' && body) {
            for (const [key, value] of Object.entries(body)) {
                if (!value) continue;
                url.searchParams.set(key, value);
            }
        } else {
            opts.body = JSON.stringify(body);
        }

        const promise = fetch(url, opts)
            .then(async req => [await req.json(), req.status === 429])
            .then(([res, isRatelimit]) => {
                delete this.apiReqs[url];
                if (res.code === 40062 || isRatelimit) {
                    const stamp = Date.now() + (res.retry_after * 1000);
                    if (res.global) this.globalLimit = stamp;
                    else this.limitedApis[path] = stamp;
                }
                if ('code' in res) {
                    console.log('Discord API response error:', stringifyError(body, res));
                    return Promise.reject(res);
                }
                return res;
            })
            .catch(message => Promise.reject({ message }));
        this.apiReqs[url] = promise;
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
        this.mustAuthImmediate = !useGateway;
        const reconUrl = useGateway
            ? gateway
            : this.reconUrl;
        this.websocket.close();
        delete this.websocket;
        const url = new URL(reconUrl);
        url.searchParams.set('v', this.version);
        url.searchParams.set('encoding', 'json');
        url.searchParams.set('compress', 'zlib-stream');
        this.websocket = new WebSocket(url);
        this.websocket.binaryType = "arraybuffer";
        this.websocket.onopen = this.onopen.bind(this);
        this.websocket.onmessage = this.onmessage.bind(this);
        this.websocket.onerror = this.onerror.bind(this);
        this.websocket.onclose = this.onclose.bind(this);
        this.emit('reconnect', message);
    }
    onopen() {
        this.emit('open');
        if (this.mustAuthImmediate) {
            // always unset because this is for an explicit task that can not be reiterated elsewhen
            this.mustAuthImmediate = false;
            this.send(GatewayOpcode.Resume, {
                token: this.#token,
                session_id: this.sessionId,
                seq: this.seq
            });
        }
    }
    onmessage(e) {
        const data = new Uint8Array(e.data);
        this.emit('message', data);
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
        this.emit('packet', { opcode, data, seq, event });
        if (seq) this.seq = seq;
        if (event) return this.onevent(event, data);
        console.log('gateway op:', GatewayOpcode[opcode] ?? opcode, 'd:', data, 's:', seq, 't:', event);
        switch (opcode) {
        case GatewayOpcode.Heartbeat:
            this.send(GatewayOpcode.HeartbeatACK);
            break;
        case GatewayOpcode.Reconnect:
            this.reconnect(false, 'server requested reconnect');
            break;
        case GatewayOpcode.InvalidSession:
            this.emit('invalid');
            break;
        case GatewayOpcode.Hello:
            this.heart = setInterval(() => {
                if (this.waitingResponse) return this.reconnect(false, 'no pong to our ping')
                this.send(GatewayOpcode.Heartbeat, this.seq)
            }, data.heartbeat_interval);
            this.send(GatewayOpcode.Identify, {
                "token": this.#token,
                "capabilities": 16381,
                "properties": { 
                    "os": "Win32",
                    "browser": "Mozilla",
                    "device": "",
                    "system_locale": 'en',
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
        if (DebuggerEvents.includes(event) || DebuggerEvents.length === 0) console.log(event, data);
        this.stores.forEach(store => {
            if (store.listens.includes(event))
                store.notify(event, data);
        });
        this.emit(event, data);
    }
    onerror() {
        this.emit('error');
        this.reconnect(false, 'websocket errored');
    }
    onclose() {
        this.emit('close');
        clearInterval(this.heart);
    }

    send(opcode, data) {
        this.emit('packet', { opcode, data });
        console.log('gateway op:', GatewayOpcode[opcode] ?? opcode, 'd:', data);
        const obj = {
            op: opcode,
            d: data
        };
        this.websocket.send(JSON.stringify(obj));
    }
}
