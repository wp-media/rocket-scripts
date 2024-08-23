'use strict';

import BeaconUtils from "./Utils.js";
import BeaconManager from "./BeaconManager.js";

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
        const elements = document.querySelectorAll(this.config.lrc_elements);

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
        return Math.max(0, rect.top + scrollTop - (window.innerHeight || document.documentElement.clientHeight));
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

            const color = (depth === 2 && distance >= this.config.lrc_threshold) || (element.parentElement && this._getElementDistance(element.parentElement) === 0 && distance >= this.config.lrc_threshold) ? "green" : distance === 0 ? "red" : "";
            this.logger.logColoredMessage( `${'\t'.repeat(depth)}${element.tagName} (Depth: ${depth}, Distance from viewport top: ${distance}px)`, color );

            //const xpath = this._getXPath(element);
            //console.log(`%c${'\t'.repeat(depth)}Xpath: ${xpath}`, style);

            this.logger.logColoredMessage(`${'\t'.repeat(depth)}Location hash: ${hash}`, color);

            this.logger.logColoredMessage(`${'\t'.repeat(depth)}Dimensions Client Height: ${element.clientHeight}`, color);

            // Check if the element is a parent at depth 2 with distance >= this.config.lrc_threshold
            if (depth === 2 && distance >= this.config.lrc_threshold) {
                this.lazyRenderElements.push(hash);
                this.logger.logMessage(`Parent element at depth 2 with distance >= this.config.lrc_threshold pushed with hash: ${hash}`);
                return;
            }
    
            // Check parent element with distance of 0 but children is within threshold.
            if (element.parentElement && this._getElementDistance(element.parentElement) === 0 && distance >= this.config.lrc_threshold) {
                this.lazyRenderElements.push(hash); // Push the child's hash
                this.logger.logMessage(`Child element pushed with hash: ${hash}`);
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