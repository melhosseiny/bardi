import katex from "https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.mjs";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const findEndOfMath = function(delimiter, text, startIndex) {
    // Adapted from
    // https://github.com/Khan/perseus/blob/master/src/perseus-markdown.jsx
    let index = startIndex;
    let braceLevel = 0;

    const delimLength = delimiter.length;

    while (index < text.length) {
        const character = text[index];

        if (braceLevel <= 0 &&
            text.slice(index, index + delimLength) === delimiter) {
            return index;
        } else if (character === "\\") {
            index++;
        } else if (character === "{") {
            braceLevel++;
        } else if (character === "}") {
            braceLevel--;
        }

        index++;
    }

    return -1;
};

const escapeRegex = function(string) {
    return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
};

const amsRegex = /^\\begin{/;

const splitAtDelimiters = function(text, delimiters) {
    let index;
    const data = [];

    const regexLeft = new RegExp(
        "(" + delimiters.map((x) => escapeRegex(x.left)).join("|") + ")"
    );

    while (true) {
        index = text.search(regexLeft);
        if (index === -1) {
            break;
        }
        if (index > 0) {
            data.push({
                type: "text",
                data: text.slice(0, index),
            });
            text = text.slice(index); // now text starts with delimiter
        }
        // ... so this always succeeds:
        const i = delimiters.findIndex((delim) => text.startsWith(delim.left));
        index = findEndOfMath(delimiters[i].right, text, delimiters[i].left.length);
        if (index === -1) {
            break;
        }
        const rawData = text.slice(0, index + delimiters[i].right.length);
        const math = amsRegex.test(rawData)
            ? rawData
            : text.slice(delimiters[i].left.length, index);
        data.push({
            type: "math",
            data: math,
            rawData,
            display: delimiters[i].display,
        });
        text = text.slice(index + delimiters[i].right.length);
    }

    if (text !== "") {
        data.push({
            type: "text",
            data: text,
        });
    }

    return data;
};

/* Note: optionsCopy is mutated by this method. If it is ever exposed in the
 * API, we should copy it before mutating.
 */
const renderMathInText = function(text, optionsCopy) {
    const data = splitAtDelimiters(text, optionsCopy.delimiters);
    if (data.length === 1 && data[0].type === 'text') {
        // There is no formula in the text.
        // Let's return null which means there is no need to replace
        // the current text node with a new one.
        return null;
    }
    
    console.log(data);

    const rendered = data.map(part => part.type === "math" ? katex.renderToString(part.data, Object.assign({}, optionsCopy, { displayMode: part.display })) : part.data);
    
    console.log('####');
    console.log(rendered);
    
    return rendered.join('\n');
};

export function renderMath(text, options) {
    if (!text) {
        throw new Error("No text provided to render");
    }

    const optionsCopy = {};

    // Object.assign(optionsCopy, option)
    for (const option in options) {
        if (options.hasOwnProperty(option)) {
            optionsCopy[option] = options[option];
        }
    }

    // default options
    optionsCopy.delimiters = optionsCopy.delimiters || [
        {left: "$$", right: "$$", display: true},
        {left: "\\(", right: "\\)", display: false},
        // LaTeX uses $…$, but it ruins the display of normal `$` in text:
        // {left: "$", right: "$", display: false},
        // $ must come after $$

        // Render AMS environments even if outside $$…$$ delimiters.
        {left: "\\begin{equation}", right: "\\end{equation}", display: true},
        {left: "\\begin{align}", right: "\\end{align}", display: true},
        {left: "\\begin{alignat}", right: "\\end{alignat}", display: true},
        {left: "\\begin{gather}", right: "\\end{gather}", display: true},
        {left: "\\begin{CD}", right: "\\end{CD}", display: true},

        {left: "\\[", right: "\\]", display: true},
    ];
    optionsCopy.ignoredTags = optionsCopy.ignoredTags || [
        "script", "noscript", "style", "textarea", "pre", "code", "option",
    ];
    optionsCopy.ignoredClasses = optionsCopy.ignoredClasses || [];
    optionsCopy.errorCallback = optionsCopy.errorCallback || console.error;

    // Enable sharing of global macros defined via `\gdef` between different
    // math elements within a single call to `renderMathInElement`.
    optionsCopy.macros = optionsCopy.macros || {};

    return renderMathInText(text, optionsCopy);
};
