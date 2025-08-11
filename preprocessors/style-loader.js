module.exports = function(text) {
    return `
    const style = new CSSStyleSheet();
    style.replaceSync(${JSON.stringify(text)});
    module.exports = style;
    `;
}