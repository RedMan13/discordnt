const mime = require('mime-types');
const path = require('path');

module.exports = function(src) {
    const type = mime.lookup(this.resourcePath);
    // incase we ever find a none-buffer value here, always create a new buffer from src
    const b64 = Buffer.from(src).toString('base64url');
    const url = `data:${type};base64,${b64}`;
    const { name } = path.parse(this.resourcePath);
    return `
    const link = ${JSON.stringify(url)};
    const Element = defineElement(${JSON.stringify(name)}, {}, function(shadow) {
        const img = new Image();
        img.style.width = '100%';
        img.style.height = '100%';
        img.src = link;
        shadow.appendChild(img);
    });
    module.exports = Element;
    `;
}