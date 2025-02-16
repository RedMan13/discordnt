export class EventSource {
    #listeners = {};
    constructor() {}

    /**
     * Registers a listner to run every time an event is dispatched
     * @param {string} ev The event name
     * @param {...Function} funcs The function(s) to run on dispatch
     * @returns {ThisType} This event emitter
     */
    on(ev, ...funcs) {
        if (!this.#listeners[ev]) this.#listeners[ev] = [];
        this.#listeners[ev].push(...funcs.map(func => [false, func]));
        return this;
    }

    /**
     * Registers a listner to run once this event is dispatched
     * @param {string} ev The event name
     * @param {...Function} funcs The function(s) to run on dispatch
     * @returns {ThisType} This event emitter
     */
    once(ev, ...funcs) {
        if (!this.#listeners[ev]) this.#listeners[ev] = [];
        this.#listeners[ev].push(...funcs.map(func => [true, func]));
        return this;
    }
    
    /**
     * Dispatches an event name
     * @param {string} ev The event name
     * @param {...any} args Any arguments to pass on
     */
    emit(ev, ...args) {
        if (!this.#listeners[ev]) return;
        this.#listeners[ev].forEach(async ([once, func], i) => {
            if (once) this.#listeners[ev].splice(i, 1);
            func(...args);
        })
    }
}