'use strict';

import BeaconUtils from "./Utils.js";

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
        const svgUseTargets = this._getSvgUseTargets();

        if (elements.length <= 0) {
            return [];
        }

        const validElements = Array.from(elements).filter(element => {
            if (this._skipElement(element)) {
                return false;
            }
            if (svgUseTargets.includes(element)) {
                this.logger.logColoredMessage(`Element skipped because of SVG: ${element.tagName}`, 'orange');
                return false;
            }
            return true;
        });


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
        return Math.max(0, rect.top + scrollTop - BeaconUtils.getScreenHeight());
    }

    _skipElement(element) {
        const skipStrings = this.config.skipStrings || ['memex'];
        if (!element || !element.id) return false;
        return skipStrings.some(str => element.id.toLowerCase().includes(str.toLowerCase()));
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

    _checkLcrConflict(element) {
        const conflictingElements = [];
        const computedStyle = window.getComputedStyle(element);

        const validMargins = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];

        const negativeMargins = validMargins
            .some(margin => parseFloat(computedStyle[margin]) < 0);

        const currentElementConflicts = negativeMargins ||
          computedStyle.contentVisibility === 'auto' ||
            computedStyle.contentVisibility === 'hidden';

        if (currentElementConflicts) {
            conflictingElements.push({
                element,
                conflicts: [
                    negativeMargins && 'negative margin',
                    computedStyle.contentVisibility === 'auto' && 'content-visibility:auto',
                    computedStyle.contentVisibility === 'hidden' && 'content-visibility:hidden'
                ].filter(Boolean)
            });
        }

        Array.from(element.children).forEach(child => {
            const childStyle = window.getComputedStyle(child);

            const validMargins = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'];

            const childNegativeMargins = validMargins
                .some(margin => parseFloat(childStyle[margin]) < 0);

            const childConflicts = childNegativeMargins ||
              childStyle.position === 'absolute' ||
                childStyle.position === 'fixed';

            if (childConflicts) {
                conflictingElements.push({
                    element: child,
                    conflicts: [
                        childNegativeMargins && 'negative margin',
                        childStyle.position === 'absolute' && 'position:absolute',
                        childStyle.position === 'fixed' && 'position:fixed'
                    ].filter(Boolean)
                });
            }
        });

        return conflictingElements;
    }

    _processElements(elements) {
        elements.forEach(({ element, depth, distance, hash }) => {
            if (this._shouldSkipElement(element, this.config.exclusions || [])) {
                return;
            }

            if ( 'No hash detected' === hash ) {
                return;
            }

            const conflicts = this._checkLcrConflict(element);
            if (conflicts.length > 0) {
                this.logger.logMessage('Skipping element due to conflicts:', conflicts);
                return;
            }

            const can_push_hash = element.parentElement && this._getElementDistance(element.parentElement) < this.config.lrc_threshold && distance >= this.config.lrc_threshold;

            const color = can_push_hash ? "green" : distance === 0 ? "red" : "";
            this.logger.logColoredMessage( `${'\t'.repeat(depth)}${element.tagName} (Depth: ${depth}, Distance from viewport bottom: ${distance}px)`, color );

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
        if (element && element.id !== "") {
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

    _getSvgUseTargets() {
        const useElements = document.querySelectorAll('use');
        const targets = new Set();

        useElements.forEach(use => {
            let parent = use.parentElement;
            while (parent && parent !== document.body) {
                targets.add(parent);
                parent = parent.parentElement;
            }
        });

        return Array.from(targets);
    }

    getResults() {
        return this.lazyRenderElements;
    }
}

export default BeaconLrc;