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

    /**
     * Initiates the process of identifying and logging external domains that require preconnection.
     * This method queries the document for eligible elements, processes each element to determine
     * if it should be preconnected, and logs the results.
     */
    async run() {
        const elements = document.querySelectorAll(
            `${this.eligibleElements.join(', ')}[src], ${this.eligibleElements.join(', ')}[href], ${this.eligibleElements.join(', ')}[rel], ${this.eligibleElements.join(', ')}[type]`
        );
        
        elements.forEach(el => this.processElement(el));

        this.logger.logMessage({matchedItems: this.getMatchedItems(), excludedItems: Array.from(this.excludedItems)});
    }

    /**
     * Processes a single element to determine if it should be preconnected.
     * 
     * This method checks if the element is excluded based on attribute or domain rules.
     * If not excluded, it checks if the element's URL is an external domain and adds it to the list of matched items.
     * 
     * @param {Element} el - The element to process.
     */
    processElement(el) {
        try {
            const url = new URL(el.src || el.href || '', location.href);
            
            if (this.isExcluded(el)) {
                this.excludedItems.add(this.createExclusionObject(url, el));
                return;
            }

            if (this.isExternalDomain(url)) {
                this.matchedItems.add(`${url.hostname}-${el.tagName.toLowerCase()}`);
                this.result = [...new Set(this.result.concat(url.origin))];
            }
        } catch (e) {
            this.logger.logMessage(e);
        }
    }

    /**
     * Checks if an element is excluded based on exclusions patterns.
     * 
     * This method iterates through the excludedPatterns array and checks if any pattern matches any of the element's attribute or values.
     * If a match is found, it returns true, indicating the element is excluded.
     * 
     * @param {Element} el - The element to check.
     * @returns {boolean} True if the element is excluded by an attribute rule, false otherwise.
     */
    isExcluded(el) {
        const outerHTML = el.outerHTML.substring(0, el.outerHTML.indexOf('>') + 1);
        return this.excludedPatterns.some(
            (pattern) => outerHTML.includes(pattern)
        );
    }

    /**
     * Checks if a URL is excluded based on domain rules.
     * 
     * This method iterates through the excludedPatterns array and checks if any pattern matches the URL's hostname.
     * If a match is found, it returns true, indicating the URL is excluded.
     * 
     * @param {URL} url - The URL to check.
     * @returns {boolean} True if the URL is excluded by a domain rule, false otherwise.
     */
    isExcludedByDomain(url) {
        return this.excludedPatterns.some(pattern =>
            pattern.type === 'domain' && url.hostname.includes(pattern.value)
        );
    }

    /**
     * Checks if a URL is from an external domain.
     * 
     * This method compares the hostname of the given URL with the hostname of the current location.
     * If they are not the same, it indicates the URL is from an external domain.
     * 
     * @param {URL} url - The URL to check.
     * @returns {boolean} True if the URL is from an external domain, false otherwise.
     */
    isExternalDomain(url) {
        return url.hostname !== location.hostname && url.hostname;
    }

    /**
     * Creates an exclusion object based on the URL, element.
     * 
     * @param {URL} url - The URL to create the exclusion object for.
     * @param {Element} el - The element to create the exclusion object for.
     * @returns {Object} An object with the URL's hostname, the element's tag name, and the reason.
     */
    createExclusionObject(url, el) {        
        return { domain: url.hostname, elementType: el.tagName.toLowerCase()};
    }

    /**
     * Returns an array of matched items, each item split into its domain and element type.
     * 
     * This method iterates through the matchedItems set, splits each item into its domain and element type using the last hyphen as a delimiter,
     * and returns an array of these split items.
     * 
     * @returns {Array} An array of arrays, each containing a domain and an element type.
     */
    getMatchedItems() {
        return Array.from(this.matchedItems).map(item => {
            const lastHyphenIndex = item.lastIndexOf('-');
            return [
                item.substring(0, lastHyphenIndex), // Domain
                item.substring(lastHyphenIndex + 1) // Element type
            ];
        });
    }

    /**
     * Returns the array of unique domain names that were found to be external.
     * 
     * This method returns the result array, which contains a list of unique domain names that were identified as external during the analysis process.
     * 
     * @returns {Array} An array of unique domain names.
     */
    getResults() {
        return this.result;
    }
}

export default BeaconPreconnectExternalDomain;
