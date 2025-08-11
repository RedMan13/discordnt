const elementClassNames = {
    "a": 'HTMLAnchorElement',
    "area": 'HTMLAreaElement',
    "audio": 'HTMLAudioElement',
    "base": 'HTMLBaseElement',
    "blockquote": 'HTMLQuoteElement',
    "body": 'HTMLBodyElement',
    "br": 'HTMLBRElement',
    "button": 'HTMLButtonElement',
    "canvas": 'HTMLCanvasElement',
    "caption": 'HTMLTableCaptionElement',
    "col": 'HTMLTableColElement',
    "colgroup": 'HTMLTableColElement',
    "data": 'HTMLDataElement',
    "datalist": 'HTMLDataListElement',
    "del": 'HTMLModElement',
    "details": 'HTMLDetailsElement',
    "dialog": 'HTMLDialogElement',
    "dir": 'HTMLDirectoryElement',
    "div": 'HTMLDivElement',
    "dl": 'HTMLDListElement',
    "embed": 'HTMLEmbedElement',
    "fencedframe": 'HTMLUnknownElement',
    "fieldset": 'HTMLFieldSetElement',
    "font": 'HTMLFontElement',
    "form": 'HTMLFormElement',
    "frame": 'HTMLFrameElement',
    "frameset": 'HTMLFrameSetElement',
    "h1": 'HTMLHeadingElement',
    "head": 'HTMLHeadElement',
    "hr": 'HTMLHRElement',
    "html": 'HTMLHtmlElement',
    "iframe": 'HTMLIFrameElement',
    "img": 'HTMLImageElement',
    "input": 'HTMLInputElement',
    "ins": 'HTMLModElement',
    "label": 'HTMLLabelElement',
    "legend": 'HTMLLegendElement',
    "li": 'HTMLLIElement',
    "link": 'HTMLLinkElement',
    "map": 'HTMLMapElement',
    "marquee": 'HTMLMarqueeElement',
    "menu": 'HTMLMenuElement',
    "meta": 'HTMLMetaElement',
    "meter": 'HTMLMeterElement',
    "object": 'HTMLObjectElement',
    "ol": 'HTMLOListElement',
    "optgroup": 'HTMLOptGroupElement',
    "option": 'HTMLOptionElement',
    "output": 'HTMLOutputElement',
    "p": 'HTMLParagraphElement',
    "param": 'HTMLParamElement',
    "picture": 'HTMLPictureElement',
    "portal": 'HTMLUnknownElement',
    "pre": 'HTMLPreElement',
    "progress": 'HTMLProgressElement',
    "q": 'HTMLQuoteElement',
    "script": 'HTMLScriptElement',
    "select": 'HTMLSelectElement',
    "slot": 'HTMLSlotElement',
    "source": 'HTMLSourceElement',
    "span": 'HTMLSpanElement',
    "style": 'HTMLStyleElement',
    "table": 'HTMLTableElement',
    "tbody": 'HTMLTableSectionElement',
    "td": 'HTMLTableCellElement',
    "template": 'HTMLTemplateElement',
    "textarea": 'HTMLTextAreaElement',
    "tfoot": 'HTMLTableSectionElement',
    "th": 'HTMLTableCellElement',
    "thead": 'HTMLTableSectionElement',
    "time": 'HTMLTimeElement',
    "title": 'HTMLTitleElement',
    "tr": 'HTMLTableRowElement',
    "track": 'HTMLTrackElement',
    "ul": 'HTMLUListElement',
    "video": 'HTMLVideoElement',
    "xmp": 'HTMLPreElement'
};
// quick def for elements that dont require any direct manipulation
function defineElement(name, attributes, innerGen) {
    const extend = attributes.extends;
    /** @type {HTMLElement} */
    const elClass = window[elementClassNames[extend]] ?? HTMLElement;
    let onAttributes;
    class newElement extends elClass {
        static observedAttributes = Object.keys(attributes)
            .filter(key => !key.startsWith('on') && !['extends', 'attributes'].includes(key));
        display = null;
        priv = {};
        constructor() {
            if (extend) 
                return document.createElement(extend, { is: name });
            super();
            if (!this.display) this.display = this.attachShadow({ mode: 'open' });
            if (attributes.styles)
                this.shadowRoot.adoptedStyleSheets = Array.isArray(attributes.styles) 
                    ? attributes.styles 
                    : [attributes.styles];
            if (this.created) this.created(); 
            innerGen.apply(this, [this.display]);
            for (const [key, val] of Object.entries(attributes)) {
                if (key === 'styles') continue;
                if (key.startsWith('on')) {
                    this.addEventListener(key.slice(2), val.bind(this));
                    continue;
                }
                this.setAttribute(key, val);
            }
        }
        attributeChangedCallback(key, oldVal, newVal) {
            onAttributes?.apply?.(this, [key, oldVal, newVal]);
            if (key in newElement.prototype) return;
            this[key] = newVal;
        }    
    } 
    for (const key in attributes) {
        if (key.startsWith('on')) {
            switch (key.slice(3)) {
            case 'created':
                newElement.prototype.created = attributes[key];
                delete attributes[key];
                break;
            case 'connected':
                newElement.prototype.connectedCallback = attributes[key];
                delete attributes[key];
                break;
            case 'disconnected':
                newElement.prototype.disconnectedCallback = attributes[key];
                delete attributes[key];
                break;
            case 'adopted':
                newElement.prototype.adoptedCallback = attributes[key];
                delete attributes[key];
                break;
            case 'attributes':
                onAttributes = attributes[key];
                delete attributes[key];
                break;
            }
            continue;
        }
    }
    if (attributes.attributes) {
        newElement.observedAttributes = attributes.attributes;
        delete attributes.attributes;
    }
    if (attributes.this) {
        Object.assign(newElement.prototype, attributes.this);
        delete attributes.this;
    }
    delete attributes.extends;
    customElements.define(name, newElement, { extends: attributes.extends });
    return newElement;
} 
function appendChildren(parent, children) {
    children.forEach(child => {
        if (!child) return;
        if (Array.isArray(child))
            return appendChildren(parent, child);

        try { parent.appendChild(child); }
        catch (e) {
            parent.appendChild(document.createTextNode(String(child)));
        }
    });
}
/** @param {HTMLElement} el */
function setAttribute(el, key, val) {
    if (val) {
        // any none-string value should be passed manually to preserve type
        // dont set attributes if we do pass this manually, as that is a 
        // significant slow down for really no gain at all
        const clas = Object.getPrototypeOf(el).constructor;
        if (typeof val !== 'string' && el.attributeChangedCallback && 
            clas.observedAttributes?.includes?.(key)) {
            // use el.getAttributes because *technically* we should, even if old_value
            // isnt really ever used by anything
            el.attributeChangedCallback(key, el.getAttribute(key), val);
            return;
        } else if (typeof val === 'object') {
            if (!el.attributeChangedCallback)
                console.warn(el, 'does not provide a attribute observer to hand', key, val);
            else if (!clas.observedAttributes?.includes?.(key))
                console.warn(el, 'does not listen to', key, 'and so cant recieve', val);
            else 
                console.warn('what???????????', el, key, val);
        }
        el.setAttribute(key, typeof val === 'object' ? JSON.stringify(val) : val);
        return;
    }
    el.removeAttribute(key);
}
window.appendChildren = appendChildren;
window.setAttribute = setAttribute;
window.defineElement = defineElement;