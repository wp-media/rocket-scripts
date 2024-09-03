'use strict';

import BeaconUtils from "./Utils.js";
import BeaconManager from "./BeaconManager.js";
import Utils from "./Utils.js";

class BeaconLrc {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.lazyRenderElements = [];
    }

    async run() {
        try {
            const elementsInView = this._getLazyRenderElements();
            if (elementsInView) {
                this._processElements(elementsInView);
            }
        } catch (err) {
            this.errorCode = 'script_error';
            this.logger.logMessage('Script Error: ' + err);
        }
    }

    _getLazyRenderElements() {
        const elements = document.querySelectorAll('[data-rocket-location-hash]');

        if (elements.length <= 0) {
            return [];
        }

        const validElements = Array.from(elements).filter(element => !this._skipElement(element));

        return validElements.map(element => ({
            element: element,
            depth: this._getElementDepth(element),
            distance: this._getElementDistance(element),
            hash: this._getLocationHash(element)
        }));
    }

    _getElementDepth(element) {
        let depth = 0;
        let parent = element.parentElement;
        while (parent) {
            depth++;
            parent = parent.parentElement;
        }
        return depth;
    }

    _getElementDistance(element) {
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        return Math.max(0, rect.top + scrollTop - Utils.getScreenHeight());
    }

    _skipElement(element) {
        const skipStrings = this.config.skipStrings || ['memex'];
        if (!element || !element.id) return false;
        return skipStrings.some(str => element.id.toLowerCase().includes(str));
    }

    _shouldSkipElement(element, exclusions) {
        if (!element) return false;
        for (let i = 0; i < exclusions.length; i++) {
            const [attribute, pattern] = exclusions[i];
            const attributeValue = element.getAttribute(attribute);
            if (attributeValue && new RegExp(pattern, 'i').test(attributeValue)) {
                return true;
            }
        }
        return false;
    }

    _processElements(elements) {
        elements.forEach(({ element, depth, distance, hash }) => {
            if (this._shouldSkipElement(element, this.config.exclusions || [])) {
                return;
            }

            if ( 'No hash detected' === hash ) {
                return;
            }

            const can_push_hash = element.parentElement && this._getElementDistance(element.parentElement) < this.config.lrc_threshold && distance > this.config.lrc_threshold;

            const color = can_push_hash ? "green" : distance === 0 ? "red" : "";
            this.logger.logColoredMessage( `${'\t'.repeat(depth)}${element.tagName} (Depth: ${depth}, Distance from viewport top: ${distance}px)`, color );

            //const xpath = this._getXPath(element);
            //console.log(`%c${'\t'.repeat(depth)}Xpath: ${xpath}`, style);

            this.logger.logColoredMessage(`${'\t'.repeat(depth)}Location hash: ${hash}`, color);

            this.logger.logColoredMessage(`${'\t'.repeat(depth)}Dimensions Client Height: ${element.clientHeight}`, color);

            if (can_push_hash) {
                this.lazyRenderElements.push(hash); // Push the hash
                this.logger.logMessage(`Element pushed with hash: ${hash}`);
            }
        });
    }

    _getXPath(element) {
        if (element.id !== "") {
            return `//*[@id="${element.id}"]`;
        }

        return this._getElementXPath(element);
    }

    _getElementXPath(element) {
        if (element === document.body) {
            return '/html/body';
        }
        const position = this._getElementPosition(element);
        return `${this._getElementXPath(element.parentNode)}/${element.nodeName.toLowerCase()}[${position}]`;
    }

    _getElementPosition(element) {
        let pos = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.nodeName === element.nodeName) {
                pos++;
            }
            sibling = sibling.previousElementSibling;
        }
        return pos;
    }

    _getLocationHash(element) {
        return element.hasAttribute('data-rocket-location-hash')
            ? element.getAttribute('data-rocket-location-hash')
            : 'No hash detected';
    }

    getResults() {
        return this.lazyRenderElements;
    }
}

export default BeaconLrc;