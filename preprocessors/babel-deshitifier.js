module.exports = str => {
    // do if->def to prevent hoisting from making undefined variables
    return `
    if (!module) var module = __unused_webpack_module ?? __webpack_module__;
    if (!exports) var exports = __unused_webpack_exports ?? __webpack_exports__;
    if (!require) var require = __unused_webpack_require ?? __webpack_require__;
    ${str}
    `;
}