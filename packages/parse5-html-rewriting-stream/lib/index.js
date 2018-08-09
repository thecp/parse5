'use strict';

const SAXParser = require('parse5-sax-parser');
const { escapeString } = require('parse5/lib/serializer');

class RewritingStream extends SAXParser {
    constructor() {
        super({ sourceCodeLocationInfo: true });

        this.posTracker = this.locInfoMixin.posTracker;
    }

    _transform(chunk, encoding, callback) {
        this._parseChunk(chunk);

        callback();
    }

    _getCurrentTokenRawHtml() {
        const droppedBufferSize = this.posTracker.droppedBufferSize;
        const start = this.currentTokenLocation.startOffset - droppedBufferSize;
        const end = this.currentTokenLocation.endOffset - droppedBufferSize;

        return this.tokenizer.preprocessor.html.slice(start, end);
    }

    // Events
    _handleToken(token) {
        if (!super._handleToken(token)) {
            this.emitRaw(this._getCurrentTokenRawHtml());
        }

        // NOTE: don't skip new lines after <pre> and other tags,
        // otherwise we'll have incorrect raw data.
        this.parserFeedbackSimulator.skipNextNewLine = false;
    }

    // Emitter API
    _emitToken(eventName, token) {
        this.emit(eventName, token, this._getCurrentTokenRawHtml());
    }

    emitDoctype(token) {
        let res = `<!DOCTYPE ${token.name}`;

        if (token.publicId !== null) {
            res += ` PUBLIC "${token.publicId}"`;
        } else if (token.systemId !== null) {
            res += ' SYSTEM';
        }

        if (token.systemId !== null) {
            res += ` "${token.systemId}"`;
        }

        res += '>';

        this.push(res);
    }

    emitStartTag(token) {
        let res = `<${token.tagName}`;

        const attrs = token.attrs;

        for (let i = 0; i < attrs.length; i++) {
            res += ` ${attrs[i].name}="${escapeString(attrs[i].value, true)}"`;
        }

        res += token.selfClosing ? '/>' : '>';

        this.push(res);
    }

    emitEndTag(token) {
        this.push(`</${token.tagName}>`);
    }

    emitText({ text }) {
        this.push(escapeString(text, false));
    }

    emitComment(token) {
        this.push(`<!--${token.text}-->`);
    }

    emitRaw(html) {
        this.push(html);
    }
}

module.exports = RewritingStream;