import { IndexedMap } from "./indexed-map.js";
import { EventSource } from "./event-source.js";
import { checkType } from "./type-enums.js";

export { IndexedMap };
export class LimitedStore extends IndexedMap {
    /**
     * @param {number} max The maximum number of allowed elements
     * @param {number} min The minimum number of allowed elements
     */
    constructor(client, min = 0, max = Infinity, strictTypes) {
        super(true);
        this.listeners = {};
        this.client = client;
        this.max = max;
        this.min = min;
        this.valType = strictTypes;
    }
    /**
     * @param {number} len The amount to add
     */
    fill(len) {}
    /**
     * @param {string} key The key name of the added element
     * @param {any} added The newly added element, null on all operations other then set
     */
    _check(off, key, added) {
        let size = this.size + (off || 0);
        while (size-- > this.max)
            this.delete(0, true);
        size++;
        if (size < this.min)
            this.fill(this.min - size);

        if (added && this.valType && !checkType(added, this.valType)) {
            this.delete(key, true);
            throw new TypeError(`Invalid data type given to store ${Object.prototype.toString.apply(this)} (got ${added} expected ${this.valType})`);
        }
    }

    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    set(key, val, dontCheck) { this.push(key, val, dontCheck); }
    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    push(key, val, dontCheck) { if (!dontCheck) this._check(1, key, val); super.push(key, val); }
    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    shift(key, val, dontCheck) { this.insert(0, key, val, dontCheck); }
    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    insert(idx, key, val, dontCheck) { if (!dontCheck) this._check(1, key, val); super.insert(idx, key, val); }
    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    delete(key, dontCheck) { if (!dontCheck) this._check(-1); super.delete(key); }
    /** @param {boolean} dontCheck Cancel validating if this is correct or not */
    clear(dontCheck) { if (!dontCheck) this._check(-this.size); super.clear(); }
}