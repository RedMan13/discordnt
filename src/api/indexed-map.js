import { EventSource } from "./event-source.js";

export class IndexedMap extends EventSource {
    /** @type {string[]} */
    #keys = [];
    /** @type {Object<null>} */
    #items = Object.create(null);
    constructor(assigns) {
        super();
        this.assigns = !!assigns;
    }

    [Symbol.iterator] = function*() {
        for (let i = 0; i < this.size; i++) {
            const key = this.#keys[i];
            yield [key, this.#items[key]];
        }
    }

    /** @returns {number} The number of keys stored */
    get size() { return this.#keys.length; }

    indexOf(key) {
        if (typeof key === "number") return key;
        return this.#keys.indexOf(key);
    }

    /**
     * @param {string|number} key The keyname of index of an item inside the map
     * @returns {any}
     */
    get(key) {
        if (typeof key === 'number')
            return this.#items[this.#keys.at(key)];
        return this.#items[key];
    }

    /**
     * Appends a key into the map if it doesnt already exist
     * @param {string|number} key The keyname or index of an item inside the map
     * @param {any} value The value to insert
     * @returns {number} The length of the map after adding this value
     */
    set(key, value) { return this.push(key, value); }

    /**
     * Appends a key into the map if it doesnt already exist
     * @param {string|number} key The keyname or index of an item inside the map
     * @param {any} value The value to insert
     * @returns {number} The length of the map after adding this value
     */
    push(key, value) {
        if (typeof key === 'number') 
            key = this.#keys[key];

        if (this.assigns && this.#keys.includes(key))
            Object.assign(this.#items[key], value);
        else
            this.#items[key] = value;
        if (!this.#keys.includes(key))
            this.#keys.push(`${key}`);

        const old = this.#items[key];
        this.emit('set', key, old, value);
        this.emit('push', key, old, value);
        this.emit('changed', [key, old, value]);
        return this.#keys.length;
    }

    /**
     * Prepends a key into the map if it doesnt already exist
     * @param {string|number} key The keyname or index of an item inside the map
     * @param {any} value The value to insert
     * @returns {number} The length of the map after adding this value
     */
    shift(key, value) { return this.insert(0, key, value); }

    /**
     * Inserts a key into the map if it doesnt already exist
     * @param {number} idx The index to insert this key at
     * @param {string|number} key The keyname or index of an item inside the map
     * @param {any} value The value to insert
     * @returns {number} The length of the map after adding this value
     */
    insert(idx, key, value) {
        if (typeof key === 'number') 
            key = this.#keys[key];

        if (this.assigns && this.#keys.includes(key))
            Object.assign(this.#items[key], value);
        else
            this.#items[key] = value;
        if (!this.#keys.includes(key))
            this.#keys.splice(idx, 0, `${key}`);
        
        const old = this.#items[key];
        this.emit('set', key, old, value);
        this.emit('insert', idx, key, old, value);
        this.emit('changed', [idx, key, old, value]);
        return this.#keys.length;
    }

    /**
     * Moves the index of a key inside the map
     * @param {string|number} key The keyname or index of an item inside the map
     * @param {number} newIdx The new index that this key should be in
     * @returns {boolean} The if the move was successfull
     */
    move(key, newIdx) {
        const idx = typeof key === 'number' 
            ? key 
            : this.#keys.indexOf(`${key}`);
        if (idx < 0) return false;
        key = this.#keys.splice(idx, 1);
        this.#keys.splice(newIdx, 0, `${key}`);
        this.emit('move', key, idx, newIdx);
        this.emit('changed', [key, idx, newIdx]);
        return true;
    }

    /**
     * @param {string|number} key The keyname or index of an item inside the map
     * @returns {boolean}
     */
    has(key) {
        if (typeof key === 'number')
            return typeof this.#keys[key] === 'string';
        return this.#keys.includes(`${key}`);
    }

    /**
     * @param {string|number} key The keyname or index of an item inside the map
     * @returns {boolean} If the removal was successfull
     */
    delete(key) {
        const idx = typeof key === 'number' 
            ? key 
            : this.#keys.indexOf(`${key}`);
        if (idx >= 0 && this.has(key)) {
            if (typeof key === 'number') 
                key = this.#keys[key];
            this.#keys.splice(idx, 1);

            const old = this.#items[key];
            this.emit('delete', key, idx, old);
            this.emit('changed', [key, old]);
            return delete this.#items[key];
        }
        return false;
    }
    remove = IndexedMap.prototype.delete;
    bulkDel(start, end) {
        if (Array.isArray(start)) {
            start.forEach(key => {
                const idx = this.#keys.indexOf(key);
                this.#keys.splice(idx, 1);
            });
        }
        const spliced = Array.isArray(start) ? start : this.#keys.splice(start, end - start);
        spliced.forEach(key => delete this.#items[key]);

        this.emit('bulkDelete', spliced, start, end);
        this.emit('changed', spliced);
    }

    /**
     * Deletes all contents of this array
     */
    clear() {
        this.emit('clear');
        this.emit('changed');
        this.#keys = [];
        this.#items = Object.create(null);
    }
}