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

        const existed = this.#items[key];
        if (this.assigns && this.#keys.includes(key))
            Object.assign(this.#items[key], value);
        else
            this.#items[key] = value;
        if (!this.#keys.includes(key))
            this.#keys.push(`${key}`);

        const old = this.#items[key];
        this.emit('set', key, old, value);
        if (!existed) this.emit('push', key, old, value);
        if (existed) this.emit('changed', [key, old, value]);
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
    /**
     * Only return true if the given predicate returns true for all members
     * @param {(item: [string, any], index: number, [string, any][]) => boolean} func 
     */
    every(func) {
        const items = [...this];
        let res = true;
        for (let i = 0; i < items.length; i++)
            res &&= func(items[i], i, items);
        return res;
    }
    /**
     * Find one member that this predicate returns true for
     * @param {(item: [string, any], index: number, [string, any][]) => boolean} func 
     */
    find(func) {
        const items = [...this];
        for (let i = 0; i < items.length; i++) 
            if (func(items[i], i, items))
                return items[i];
    }
    /**
     * Find the index of one member that this predicate returns true for
     * @param {(item: [string, any], index: number, [string, any][]) => boolean} func 
     */
    findIndex(func) {
        const items = [...this];
        for (let i = 0; i < items.length; i++) 
            if (func(items[i], i, items))
                return i;
    }
    /**
     * Find all members that this predicate returns true for
     * @param {(item: [string, any], index: number, [string, any][]) => boolean} func 
     */
    filter(func) {
        const items = [...this];
        const res = [];
        for (let i = 0; i < items.length; i++) 
            if (func(items[i], i, items))
                res.push(items[i]);
        return res;
    }
    /**
     * Run this predicate on all members
     * @param {(item: [string, any], index: number, [string, any][]) => void} func 
     */
    forEach(func) {
        const items = [...this];
        for (let i = 0; i < items.length; i++) 
            func(items[i], i, items);
    }
    /**
     * Mutate the contents via predicate
     * @param {(item: [string, any], index: number, [string, any][]) => any} func 
     */
    map(func) {
        const items = [...this];
        const res = []
        for (let i = 0; i < items.length; i++) 
            res.push(func(items[i], i, items));
        return res;
    }
    /**
     * Reduce this map into some other data type
     * @param {(current: any, item: [string, any], index: number, [string, any][]) => any} func 
     * @param {any} initial what to initialize current to
     */
    reduce(func, initial) {
        const items = [...this];
        let current = initial;
        for (let i = 0; i < items.length; i++) 
            current = func(current, items[i], i, items);
        return current;
    }
    /**
     * Reduce this map into some other data type, but from the end of the array
     * @param {(current: any, item: [string, any], index: number, [string, any][]) => any} func 
     * @param {any} initial what to initialize current to
     */
    reduceRight(func, initial) {
        const items = [...this];
        let current = initial;
        for (let i = items.length -1; i >= 0; i--) 
            current = func(current, items[i], i, items);
        return current;
    }
    /**
     * Sort the contents of this map according to this predicate
     * @param {(itemA: [string, any], itemB: [string, any], index: number, [string, any][]) => number} func 
     */
    sort(func) {
        const items = [...this].sort(func);
        for (let i = 0; i < items.length; i++) {
            const idx = this.#keys.indexOf(items[i][0]);
            const key = this.#keys.splice(idx, 1);
            this.#keys.splice(i, 0, key);
        }
        return items;
    }
    /**
     * Return true if this predicate returns true for one of the members
     * @param {(item: [string, any], index: number, [string, any][]) => boolean} func 
     */
    some(func) {
        const items = [...this];
        for (let i = 0; i < items.length; i++) 
            if (func(items[i], i, items))
                return true;
        return false;
    }

    /**
     * Returns all entries, in order, from inside this map
     * @returns {[string, any][]}
     */
    entries() { return this.#keys.map(key => [key, this.#items[key]]); }
    /**
     * Returns all keys, in order, from inside this map
     * @returns {string[]}
     */
    keys() { return [...this.#keys] }
    /**
     * Returns all values, in order, from inside this map
     * @returns {any[]}
     */
    values() { return this.#keys.map(key => this.#items[key]); }
}