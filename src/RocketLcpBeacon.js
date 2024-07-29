'use strict';

import BeaconUtils from "./Utils.js";
import Logger from "./Logger.js";

class RocketLcpBeacon {
    constructor(config) {
        this.config = config;
        this.performanceImages = [];
        this.errorCode = '';
        this.logger = new Logger(this.config.debug);
    }

    async run() {
        try {
            const above_the_fold_images = this._generateLcpCandidates(Infinity);
            if (above_the_fold_images) {
                this._initWithFirstElementWithInfo(above_the_fold_images);
                this._fillATFWithoutDuplications(above_the_fold_images);
            }
        } catch (err) {
            this.errorCode = 'script_error';
            this.logger.logMessage('Script Error: ' + err);
        }
    }

    _generateLcpCandidates(count) {
        const lcpElements = document.querySelectorAll(this.config.elements);

        if (lcpElements.length <= 0) {
            return [];
        }

        const potentialCandidates = Array.from(lcpElements);

        const topCandidates = potentialCandidates.map(element => {
            if ('img' === element.nodeName.toLowerCase() && 'picture' === element.parentElement.nodeName.toLowerCase()) {
                return null;
            }
            let rect;
            if ('picture' === element.nodeName.toLowerCase()) {
                const imgElement = element.querySelector('img');
                if (imgElement) {
                    rect = imgElement.getBoundingClientRect();
                } else {
                    return null;
                }
            } else {
                rect = element.getBoundingClientRect();
            }

            return {
                element: element,
                rect: rect,
            };
        })
            .filter(item => item !== null)
            .filter(item => {
                return (
                    item.rect.width > 0 &&
                    item.rect.height > 0 &&
                    BeaconUtils.isIntersecting(item.rect)
                );
            })
            .map(item => ({
                item,
                area: this._getElementArea(item.rect),
                elementInfo: this._getElementInfo(item.element),
            }))
            .sort((a, b) => b.area - a.area)
            .slice(0, count);

        return topCandidates.map(candidate => ({
            element: candidate.item.element,
            elementInfo: candidate.elementInfo,
        }));
    }

    _getElementArea(rect) {
        const visibleWidth = Math.min(rect.width, (window.innerWidth || document.documentElement.clientWidth) - rect.left);
        const visibleHeight = Math.min(rect.height, (window.innerHeight || document.documentElement.clientHeight) - rect.top);

        return visibleWidth * visibleHeight;
    }

    _getElementInfo(element) {
        const nodeName = element.nodeName.toLowerCase();
        const element_info = {
            type: "",
            src: "",
            srcset: "",
            sizes: "",
            sources: [],
            bg_set: [],
            current_src: ""
        };

        const css_bg_url_rgx = /url\(\s*?['"]?\s*?(.+?)\s*?["']?\s*?\)/ig;

        if (nodeName === "img" && element.srcset) {
            element_info.type = "img-srcset";
            element_info.src = element.src;
            element_info.srcset = element.srcset;
            element_info.sizes = element.sizes;
            element_info.current_src = element.currentSrc;
        } else if (nodeName === "img") {
            element_info.type = "img";
            element_info.src = element.src;
            element_info.current_src = element.currentSrc;
        } else if (nodeName === "video") {
            element_info.type = "img";
            const source = element.querySelector('source');
            element_info.src = element.poster || (source ? source.src : '');
            element_info.current_src = element_info.src;
        } else if (nodeName === "svg") {
            const imageElement = element.querySelector('image');
            if (imageElement) {
                element_info.type = "img";
                element_info.src = imageElement.getAttribute('href') || '';
                element_info.current_src = element_info.src;
            }
        } else if (nodeName === "picture") {
            element_info.type = "picture";
            const img = element.querySelector('img');
            element_info.src = img ? img.src : "";
            element_info.sources = Array.from(element.querySelectorAll('source')).map(source => ({
                srcset: source.srcset || '',
                media: source.media || '',
                type: source.type || '',
                sizes: source.sizes || ''
            }));
        } else {
            const computed_style = window.getComputedStyle(element, null);
            const bg_props = [
                computed_style.getPropertyValue("background-image"),
                getComputedStyle(element, ":after").getPropertyValue("background-image"),
                getComputedStyle(element, ":before").getPropertyValue("background-image")
            ].filter(prop => prop !== "none");

            if (bg_props.length === 0) {
                return null;
            }
            const full_bg_prop = bg_props[0];
            element_info.type = "bg-img";
            if (full_bg_prop.includes("image-set(")) {
                element_info.type = "bg-img-set";
            }
            if (!full_bg_prop || full_bg_prop === "" || full_bg_prop.includes('data:image')) {
                return null;
            }

            const matches = [...full_bg_prop.matchAll(css_bg_url_rgx)];
            element_info.bg_set = matches.map(m => m[1] ? { src: m[1].trim() + (m[2] ? " " + m[2].trim() : "") } : {});
            if (element_info.bg_set.every(item => item.src === "")) {
                element_info.bg_set = matches.map(m => m[1] ? { src: m[1].trim() } : {});
            }

            if (element_info.bg_set.length > 0) {
                element_info.src = element_info.bg_set[0].src;
                if (element_info.type === "bg-img-set") {
                    element_info.src = element_info.bg_set;
                }
            }
        }

        return element_info;
    }

    _initWithFirstElementWithInfo(elements) {
        const firstElementWithInfo = elements.find(item => item.elementInfo !== null);

        if (!firstElementWithInfo) {
            this.logger.logMessage("No LCP candidate found.");
            this.performanceImages = [];
            return;
        }

        this.performanceImages = [{
            ...firstElementWithInfo.elementInfo,
            label: "lcp",
        }];
    }

    _fillATFWithoutDuplications(elements) {
        elements.forEach(({ element, elementInfo }) => {
            if (this._isDuplicateImage(element) || !elementInfo) {
                return;
            }

            this.performanceImages.push({ ...elementInfo, label: "above-the-fold" });
        });
    }

    _isDuplicateImage(image) {
        const elementInfo = this._getElementInfo(image);

        if (elementInfo === null) {
            return false;
        }

        const isImageOrVideo =
            elementInfo.type === "img" ||
            elementInfo.type === "img-srcset" ||
            elementInfo.type === "video";

        const isBgImageOrPicture =
            elementInfo.type === "bg-img" ||
            elementInfo.type === "bg-img-set" ||
            elementInfo.type === "picture";

        return (isImageOrVideo || isBgImageOrPicture) &&
            this.performanceImages.some(item => item.src === elementInfo.src);
    }

    getResults() {
        return this.performanceImages;
    }
}

export default RocketLcpBeacon;
