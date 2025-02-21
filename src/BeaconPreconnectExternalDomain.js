'use strict';

class BeaconPreconnectExternalDomain {
    constructor(config, logger) {
        this.logger = logger;
        this.result = [];

        this.excludedPatterns = config.preconnect_external_domain_exclusions;
        this.eligibleElements = config.preconnect_external_domain_elements;

        this.matchedItems = new Set();
        this.excludedItems = new Set();
    }

    async run() {
        const elements = document.querySelectorAll(
            `${this.eligibleElements.join(', ')}[src], ${this.eligibleElements.join(', ')}[href], ${this.eligibleElements.join(', ')}[rel], ${this.eligibleElements.join(', ')}[type]`
        );
        
        elements.forEach(el => this.processElement(el));

        this.logger.logMessage({matchedItems: this.getMatchedItems(), excludedItems: Array.from(this.excludedItems)});
    }

    processElement(el) {

        try {
            const url = new URL(el.src || el.href || '', location.href);
            
            if (this.isExcludedByAttribute(el)) {
                this.excludedItems.add(this.createExclusionObject(url, el, 'attribute'));
                return;
            }

            if (this.isExcludedByDomain(url)) {
                this.excludedItems.add(this.createExclusionObject(url, el, 'domain'));
                return;
            }

            if (this.isExternalDomain(url)) {
                this.matchedItems.add(`${url.hostname}-${el.tagName.toLowerCase()}`);
                this.result = [...new Set(this.result.concat(url.hostname))];
            }
        } catch (e) {
            this.logger.logMessage(e);
        }
    }

    isExcludedByAttribute(el) {
        return this.excludedPatterns.some(pattern =>
            pattern.type === 'attribute' && el.getAttribute(pattern.key) === pattern.value
        );
    }

    isExcludedByDomain(url) {
        return this.excludedPatterns.some(pattern =>
            pattern.type === 'domain' && url.hostname.includes(pattern.value)
        );
    }

    isExternalDomain(url) {
        return url.hostname !== location.hostname && url.hostname;
    }

    createExclusionObject(url, el, type) {
        const pattern = this.excludedPatterns.find(p => 
            (type === 'attribute' && el.getAttribute(p.key) === p.value) ||
            (type === 'domain' && url.hostname.includes(p.value))
        );
        
        let reason = type === 'attribute' ? `${pattern.key}=${pattern.value}` : `domain-partial=${pattern.value}`;
        return { domain: url.hostname, elementType: el.tagName.toLowerCase(), reason };
    }

    getMatchedItems() {
        return Array.from(this.matchedItems).map(item => {
            const lastHyphenIndex = item.lastIndexOf('-');
            return [
                item.substring(0, lastHyphenIndex),
                item.substring(lastHyphenIndex + 1)
            ];
        });
    }

    getResults() {
        return this.result;
    }
}

export default BeaconPreconnectExternalDomain;
