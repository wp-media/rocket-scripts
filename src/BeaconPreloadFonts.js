'use strict';
class BeaconPreloadFonts {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.aboveTheFoldFonts = [];
        // Use processed_extensions from config if set, otherwise default to ["woff", "woff2", "ttf"].
        const extensions = (Array.isArray(this.config.processed_extensions) && this.config.processed_extensions.length > 0
            ? this.config.processed_extensions
            : ["woff", "woff2", "ttf"])
            .map(ext => ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
        this.FONT_FILE_REGEX = new RegExp(`\\.(${extensions})(\\?.*)?$`, 'i');
    }

    /**
     * Checks if a given font family is a system font.
     * 
     * This method checks if the provided font family is part of the system fonts
     * defined in the configuration. It returns true if the font family is a system
     * font, and false otherwise.
     * 
     * @param {string} fontFamily - The font family to check.
     * @returns {boolean} True if the font family is a system font, false otherwise.
     */
    isSystemFont(fontFamily) {
        const systemFonts = new Set(this.config.system_fonts);
        return systemFonts.has(fontFamily);
    }

    /**
     * Checks if an element is visible in the viewport.
     * 
     * This method checks if the provided element is visible in the viewport by
     * considering its display, visibility, opacity, width, and height properties.
     * It returns true if the element is visible, and false otherwise.
     * 
     * @param {Element} element - The element to check for visibility.
     * @returns {boolean} True if the element is visible, false otherwise.
     */
    isElementVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return !(
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            rect.width === 0 ||
            rect.height === 0
        );
    }

    /**
     * Cleans a URL by removing query parameters and fragments.
     * 
     * This method takes a URL as input, removes any query parameters and fragments,
     * and returns the cleaned URL.
     * 
     * @param {string} url - The URL to clean.
     * @returns {string} The cleaned URL.
     */
    cleanUrl(url) {
        try {
            url = url.split('?')[0].split('#')[0];
            return new URL(url, window.location.href).href;
        } catch (e) {
            return url;
        }
    }

    /**
     * Fetches external stylesheet links from known font providers, retrieves their CSS,
     * parses them into in-memory CSSStyleSheet objects, and extracts font-family/font-face
     * information into a structured object.
     *
     * @async
     * @function externalStylesheetsDoc
     * @returns {Promise<{styleSheets: CSSStyleSheet[], fontPairs: Object}>} An object containing:
     *   - styleSheets: Array of parsed CSSStyleSheet objects (not attached to the DOM).
     *   - fontPairs: An object mapping font URLs to arrays of font variation objects
     *     ({family, weight, style}).
     *
     * @example
     * const { styleSheets, fontPairs } = await externalStylesheetsDoc();
     * this.logger.logMessage(fontPairs);
     */
    async externalStylesheetsDoc() {
        function generateFontPairsFromStyleSheets(styleSheetsArray) {
            const fontPairs = {};

            /**
             * Extracts the first URL from a CSS `src` value string.
             *
             * @param {string} srcValue - The CSS `src` value containing one or more `url(...)` references.
             * @returns {string|null} The first extracted URL if found, otherwise `null`.
             */
            function _extractFirstUrlFromSrc(srcValue) {
                if (!srcValue) return null;
                const urlMatch = srcValue.match(/url\s*\(\s*(['"]?)(.+?)\1\s*\)/);
                return urlMatch ? urlMatch[2] : null;
            }

            /**
             * Removes leading and trailing single or double quotes from a font family name and trims whitespace.
             *
             * @param {string} fontFamilyValue - The font family name to clean.
             * @returns {string} The cleaned font family name without surrounding quotes and trimmed whitespace.
             */
            function _cleanFontFamilyName(fontFamilyValue) {
                if (!fontFamilyValue) return '';
                return fontFamilyValue.replace(/^['"]+|['"]+$/g, '').trim();
            }

            if (!styleSheetsArray || !Array.isArray(styleSheetsArray)) {
                console.warn(
                    'generateFontPairsFromStyleSheets: Input is not a valid array. Received:',
                    styleSheetsArray
                );
                return fontPairs;
            }
            if (styleSheetsArray.length === 0) {
                return fontPairs;
            }

            styleSheetsArray.forEach((sheet) => {
                if (sheet && sheet.cssRules) {
                    try {
                        for (const rule of sheet.cssRules) {
                            if (rule.type === CSSRule.FONT_FACE_RULE) {
                                const cssFontFaceRule = rule;
                                const fontFamily = _cleanFontFamilyName(
                                    cssFontFaceRule.style.getPropertyValue('font-family')
                                );
                                const fontWeight =
                                    cssFontFaceRule.style.getPropertyValue('font-weight') ||
                                    'normal';
                                const fontStyle =
                                    cssFontFaceRule.style.getPropertyValue('font-style') ||
                                    'normal';
                                const src = cssFontFaceRule.style.getPropertyValue('src');
                                const fontUrl = _extractFirstUrlFromSrc(src);

                                if (fontFamily && fontUrl) {
                                    const variation = {
                                        family: fontFamily,
                                        weight: fontWeight,
                                        style: fontStyle,
                                    };
                                    if (!fontPairs[fontUrl]) fontPairs[fontUrl] = [];
                                    const variationExists = fontPairs[fontUrl].some(
                                        (v) =>
                                            v.family === variation.family &&
                                            v.weight === variation.weight &&
                                            v.style === variation.style
                                    );
                                    if (!variationExists) fontPairs[fontUrl].push(variation);
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(
                            'Error processing CSS rules from a stylesheet:',
                            e,
                            sheet
                        );
                    }
                } else if (sheet && !sheet.cssRules) {
                    console.warn(
                        'Skipping a stylesheet as its cssRules are not accessible or it is empty:',
                        sheet
                    );
                }
            });
            return fontPairs;
        }

        // --- Main logic for fetching Google Fonts ---
        const externalFontsProviders = [
            'fonts.googleapis.com',
            'fonts.gstatic.com',
            'use.typekit.net',
            'fonts.adobe.com',
            'cdn.fonts.net',
            // Add more known external font domains as needed
        ];

        const links = [
            ...document.querySelectorAll('link[rel="stylesheet"]'),
        ].filter((link) =>
            externalFontsProviders.some((domain) => link.href.includes(domain))
        );

        if (links.length === 0) {
            this.logger.logMessage('No external CSS links found to process.');
            return {
                // Consistent return structure
                styleSheets: [], // The retrievable CSSStyleSheet objects
                fontPairs: {}, // Processed data from these sheets
            };
        }

        const fetchedCssPromises = links.map((linkElement) =>
            fetch(linkElement.href, { mode: 'cors' })
                .then((response) => {
                    if (response.ok) {
                        return response.text();
                    }
                    console.warn(
                        `Failed to fetch external CSS from ${linkElement.href}: ${response.status} ${response.statusText}`
                    );
                    return null;
                })
                .catch((error) => {
                    console.error(
                        `Network error fetching external CSS from ${linkElement.href}:`,
                        error
                    );
                    return null;
                })
        );

        const cssTexts = await Promise.all(fetchedCssPromises);
        const temporaryStyleSheets = []; // These will hold the CSSStyleSheet objects

        cssTexts.forEach((txt) => {
            if (txt && txt.trim() !== '') {
                try {
                    const sheet = new CSSStyleSheet(); // Create a new CSSStyleSheet object
                    sheet.replaceSync(txt); // Parse the CSS text into it
                    temporaryStyleSheets.push(sheet); // Add to our array
                    // These sheets exist in memory only and are not applied to the document.
                } catch (error) {
                    console.error(
                        'Could not parse fetched CSS into a stylesheet:',
                        error,
                        `\nCSS (first 200 chars): ${txt.substring(0, 200)}...`
                    );
                }
            }
        });

        // At this point, `temporaryStyleSheets` contains CSSStyleSheet objects.
        if (temporaryStyleSheets.length > 0) {
            this.logger.logMessage(
                `[Beacon] ${temporaryStyleSheets.length} stylesheet(s) fetched and parsed into CSSStyleSheet objects.`
            );
        } else {
            this.logger.logMessage(
                '[Beacon] No stylesheets were successfully parsed from the fetched CSS.'
            );
        }

        // You can now process these in-memory sheets (e.g., to get font pairs)
        // This demonstrates their "processability".
        const processedFontPairs =
            generateFontPairsFromStyleSheets(temporaryStyleSheets);

        // Return the array of CSSStyleSheet objects and any processed data.
        // This makes them "retrievable".
        return {
            styleSheets: temporaryStyleSheets,
            fontPairs: processedFontPairs,
        };
    }

    /**
     * Asynchronously initializes and parses external font stylesheets.
     * 
     * Fetches external font stylesheets and font pairs using `externalStylesheetsDoc`,
     * then stores the parsed results in `externalParsedSheets` and `externalParsedPairs`.
     * Logs the process and handles errors by resetting `externalParsedSheets` to an empty array.
     * 
     * @async
     * @returns {Promise<void>} Resolves when external font stylesheets have been initialized.
     */
    async _initializeExternalFontSheets() {
        this.logger.logMessage('Initializing external font stylesheets...');
        try {
            // Assuming externalStylesheetsDoc is available in this scope
            const result = await this.externalStylesheetsDoc();
            this.externalParsedSheets = result.styleSheets || [];
            this.externalParsedPairs = result.fontPairs || [];
            this.logger.logMessage(
                `Successfully parsed ${this.externalParsedSheets.length} external font stylesheets.`
            );
        } catch (error) {
            this.logger.logMessage(
                'Error initializing external font stylesheets:',
                error
            );
            this.externalParsedSheets = []; // Ensure it's an array even on error
        }
    }

    /**
     * Retrieves a map of network-loaded fonts.
     * 
     * This method uses the Performance API to get all resource entries, filters out
     * the ones that match the font file regex, and maps them to their cleaned URLs.
     * 
     * @returns {Map} A map where each key is a cleaned URL of a font file and
     *                each value is the original URL of the font file.
     */
    getNetworkLoadedFonts() {
        return new Map(
            window.performance
                .getEntriesByType("resource")
                .filter((resource) => this.FONT_FILE_REGEX.test(resource.name))
                .map((resource) => [this.cleanUrl(resource.name), resource.name])
        );
    }

    /**
     * Retrieves font-face rules from stylesheets.
     * 
     * This method scans all stylesheets loaded on the page and collects
     * font-face rules, including their source URLs, font families, weights,
     * and styles. It returns an object containing the collected font data.
     * 
     * @returns {Object} An object mapping font families to their respective
     *                  URLs and variations.
     */
    getFontFaceRules() {
        const stylesheetFonts = {};

        Array.from(Array.from(document.styleSheets))
            .filter(sheet => !sheet.href || new URL(sheet.href).origin === location.origin)
            .forEach((sheet) => {
                try {
                    Array.from(sheet.cssRules || []).forEach((rule) => {
                        if (rule instanceof CSSFontFaceRule) {
                            const src = rule.style.getPropertyValue('src');
                            const fontFamily = rule.style.getPropertyValue('font-family')
                                .replace(/['"]+/g, '')
                                .trim();
                            const weight = rule.style.getPropertyValue('font-weight') || '400';
                            const style = rule.style.getPropertyValue('font-style') || 'normal';

                            if (!stylesheetFonts[fontFamily]) {
                                stylesheetFonts[fontFamily] = {
                                    urls: [],
                                    variations: new Set()
                                };
                            }

                            const urls = src.match(/url\(['"]?([^'"]+)['"]?\)/g) || [];
                            urls.forEach((urlMatch) => {
                                let rawUrl = urlMatch.match(/url\(['"]?([^'"]+)['"]?\)/)[1];
                                // Reconstruct url to absolute if stylesheet is not internal.
                                if (sheet.href) {
                                    rawUrl = new URL(rawUrl, sheet.href).href;
                                }
                                const normalizedUrl = this.cleanUrl(rawUrl);
                                if (!stylesheetFonts[fontFamily].urls.includes(normalizedUrl)) {
                                    stylesheetFonts[fontFamily].urls.push(normalizedUrl);
                                    stylesheetFonts[fontFamily].variations.add(JSON.stringify({
                                        weight,
                                        style
                                    }));
                                }
                            });
                        }
                    });
                } catch (e) {
                    this.logger.logMessage(e);
                }
            });

        Object.values(stylesheetFonts).forEach(fontData => {
            fontData.variations = Array.from(fontData.variations).map(v => JSON.parse(v));
        });

        return stylesheetFonts;
    }

    /**
     * Checks if an element is above the fold (visible in the viewport without scrolling).
     * 
     * @param {Element} element - The element to check.
     * @returns {boolean} True if the element is above the fold, false otherwise.
     */
    isElementAboveFold(element) {
        if (!this.isElementVisible(element)) return false;

        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const elementTop = rect.top + scrollTop;
        const foldPosition = window.innerHeight || document.documentElement.clientHeight;

        return elementTop <= foldPosition;
    }

    /**
     * Initiates the process of analyzing and summarizing font usage on the page.
     * This method fetches network-loaded fonts, stylesheet fonts, and external font pairs.
     * It then processes each element on the page to determine which fonts are used above the fold.
     * The results are summarized and logged.
     * 
     * @returns {Promise<void>} A promise that resolves when the analysis is complete.
     */
    async run() {
        // Wait for fonts to be loaded
        await document.fonts.ready;
        await this._initializeExternalFontSheets();
        const networkLoadedFonts = this.getNetworkLoadedFonts();
        const stylesheetFonts = this.getFontFaceRules();
        const hostedFonts = new Map();
        const externalFontPairs = this.config.font_data;
        const externalFontsResults = await this.processExternalFonts(externalFontPairs);

        const elements = Array.from(document.getElementsByTagName('*'))
            .filter(el => this.isElementAboveFold(el));

        elements.forEach(element => {
            const processElementFont = (style, pseudoElement = null) => {
                if (!style || !this.isElementVisible(element)) return;

                const fontFamily = style.fontFamily.split(',')[0].replace(/['"]+/g, '').trim();
                const hasContent = pseudoElement ?
                    style.content !== 'none' && style.content !== '""' :
                    element.textContent.trim();

                if (hasContent && !this.isSystemFont(fontFamily) && stylesheetFonts[fontFamily]) {
                    if (!hostedFonts.has(fontFamily)) {
                        hostedFonts.set(fontFamily, {
                            elements: new Set(),
                            urls: stylesheetFonts[fontFamily].urls,
                            variations: stylesheetFonts[fontFamily].variations
                        });
                    }
                    hostedFonts.get(fontFamily).elements.add(element);
                }
            };

            try {
                processElementFont(window.getComputedStyle(element));
                ['::before', '::after'].forEach(pseudo => {
                    processElementFont(window.getComputedStyle(element, pseudo), pseudo);
                });
            } catch (e) {
                this.logger.logMessage('Error processing element:', e);
            }
        });

        const aboveTheFoldFonts = this.summarizeMatches(externalFontsResults, hostedFonts, networkLoadedFonts);
        
        // Check if allFonts, externalFonts, and hostedFonts are empty
        if (!Object.keys(aboveTheFoldFonts.allFonts).length &&
            !Object.keys(aboveTheFoldFonts.externalFonts).length &&
            !Object.keys(aboveTheFoldFonts.hostedFonts).length) {
            this.logger.logMessage('No fonts found above the fold.');
            return;
        }

        this.logger.logMessage('Above the fold fonts:', aboveTheFoldFonts);
        this.aboveTheFoldFonts = [...new Set(Object.values(aboveTheFoldFonts.allFonts).flatMap(font => font.variations.map(variation => variation.url)))];
    }

    /**
     * Summarizes all font matches found on the page
     * Creates a comprehensive object containing font usage data
     *
     * @param {Object} externalFontsResults - Results from External Fonts analysis
     * @param {Map} hostedFonts - Map of hosted (non-External) fonts found
     * @param {Map} networkLoadedFonts - Map of all font files loaded via network
     * @returns {Object} Complete analysis of font usage including locations and counts
     */
    summarizeMatches(externalFontsResults, hostedFonts, networkLoadedFonts) {
        const allFonts = {};
        const hostedFontsResults = {};

        // Process Regular Fonts first
        if (hostedFonts.size > 0) {
            hostedFonts.forEach((data, fontFamily) => {
                if (data.variations) {
                    // Calculate elements once for the font family
                    const elements = Array.from(data.elements);
                    const aboveElements = elements.filter(el => this.isElementAboveFold(el));
                    const belowElements = elements.filter(el => !this.isElementAboveFold(el));

                    if (!allFonts[fontFamily]) {
                        allFonts[fontFamily] = {
                            type: 'hosted',
                            variations: [],
                            elementCount: {
                                aboveFold: aboveElements.length,
                                belowFold: belowElements.length,
                                total: elements.length
                            },
                            urlCount: {
                                aboveFold: new Set(),
                                belowFold: new Set()
                            }
                        };
                    }

                    data.variations.forEach(variation => {
                        let matchingUrl = null;
                        for (const styleUrl of data.urls) {
                            const normalizedStyleUrl = this.cleanUrl(styleUrl);
                            if (networkLoadedFonts.has(normalizedStyleUrl)) {
                                matchingUrl = networkLoadedFonts.get(normalizedStyleUrl);
                                break;
                            }
                        }

                        // Add variation with correct element counts
                        allFonts[fontFamily].variations.push({
                            weight: variation.weight,
                            style: variation.style,
                            url: matchingUrl || 'File not found',
                            elementCount: {
                                aboveFold: aboveElements.length,
                                belowFold: belowElements.length,
                                total: elements.length
                            }
                        });

                        // Track URLs per location
                        if (matchingUrl) {
                            if (aboveElements.length > 0) {
                                allFonts[fontFamily].urlCount.aboveFold.add(matchingUrl);
                            }
                            if (belowElements.length > 0) {
                                allFonts[fontFamily].urlCount.belowFold.add(matchingUrl);
                            }
                        }
                    });

                    if (!Object.prototype.hasOwnProperty.call(allFonts, fontFamily)) {
                        return;
                    }

                    // Copy to hostedFontsResults
                    hostedFontsResults[fontFamily] = {
                        variations: allFonts[fontFamily].variations,
                        elementCount: { ...allFonts[fontFamily].elementCount },
                        urlCount: { ...allFonts[fontFamily].urlCount },
                    };
                }
            });
        }

        // Process External Fonts
        if (Object.keys(externalFontsResults).length > 0) {
            Object.entries(externalFontsResults).forEach(([url, data]) => {
                // Only process if we're in full mode or the font appears above fold
                if (data.elementCount.aboveFold > 0) {
                    data.variations.forEach(variation => {
                        // Initialize font family entry if it doesn't exist
                        if (!allFonts[variation.family]) {
                            allFonts[variation.family] = {
                                type: 'external',
                                variations: [],
                                // Track element counts at font family level
                                elementCount: {
                                    aboveFold: 0,
                                    belowFold: 0,
                                    total: 0
                                },
                                // Track unique URLs used in each fold location
                                urlCount: {
                                    aboveFold: new Set(),
                                    belowFold: new Set()
                                }
                            };
                        }

                        // Split elements into above and below fold for accurate counting
                        const aboveElements = Array.from(data.elements).filter(el => this.isElementAboveFold(el));
                        const belowElements = Array.from(data.elements).filter(el => !this.isElementAboveFold(el));

                        // Add variation with its specific location and element counts
                        allFonts[variation.family].variations.push({
                            weight: variation.weight,
                            style: variation.style,
                            url: url,
                            elementCount: {
                                aboveFold: aboveElements.length,
                                belowFold: belowElements.length,
                                total: data.elements.length
                            }
                        });

                        // Update font family level counts
                        allFonts[variation.family].elementCount.aboveFold += aboveElements.length;
                        allFonts[variation.family].elementCount.belowFold += belowElements.length;
                        allFonts[variation.family].elementCount.total += data.elements.length;

                        // Track unique URLs per location at font family level
                        if (aboveElements.length > 0) {
                            allFonts[variation.family].urlCount.aboveFold.add(url);
                        }
                        if (belowElements.length > 0) {
                            allFonts[variation.family].urlCount.belowFold.add(url);
                        }
                    });
                }
            });
        }

        // Convert URL count Sets to numbers
        Object.values(allFonts).forEach(font => {
            font.urlCount = {
                aboveFold: font.urlCount.aboveFold.size,
                belowFold: font.urlCount.belowFold.size,
                total: new Set([...font.urlCount.aboveFold, ...font.urlCount.belowFold]).size
            };
        });

        // Also convert URL count Sets in hostedFontsResults
        Object.values(hostedFontsResults).forEach(font => {
            if (font.urlCount.aboveFold instanceof Set) {
                font.urlCount = {
                    aboveFold: font.urlCount.aboveFold.size,
                    belowFold: font.urlCount.belowFold.size,
                    total: new Set([...font.urlCount.aboveFold, ...font.urlCount.belowFold]).size
                };
            }
        });

        return {
            externalFonts: Object.fromEntries(
                Object.entries(externalFontsResults).filter(
                    (entry) => entry[1].elementCount.aboveFold > 0
                )
            ),
            hostedFonts: hostedFontsResults,
            allFonts
        };
    }

    /**
     * Processes external font pairs to identify their usage on the page.
     * 
     * This method iterates through all elements on the page, checks if they are above the fold,
     * and determines the font information for each element. It then matches the font information
     * with the provided external font pairs to identify which fonts are used and where.
     * 
     * @param {Object} fontPairs - An object where each key is a URL and the value is an array of font variations.
     * @returns {Promise<Object>} A promise that resolves to an object where each key is a URL and the value is an object containing information about the elements using that font.
     */
    async processExternalFonts(fontPairs) {
        const matches = new Map();
        const elements = Array.from(document.getElementsByTagName('*'))
            .filter(el => this.isElementAboveFold(el));

        const fontMap = new Map();
        Object.entries(fontPairs).forEach(([url, variations]) => {
            variations.forEach(variation => {
                const key = `${variation.family}|${variation.weight}|${variation.style}`;
                fontMap.set(key, { url, ...variation });
            });
        });

        const getFontInfoForElement = (style) => {
            const family = style.fontFamily
                .split(',')[0]
                .replace(/['"]+/g, '')
                .trim();
            const weight = style.fontWeight;
            const fontStyle = style.fontStyle;
            const key = `${family}|${weight}|${fontStyle}`;

            // Check if the requested font variation exists in fontMap
            let fontInfo = fontMap.get(key);

            // If the font variation does not exist, check for fallback weight (400)
            if (!fontInfo && weight !== '400') {
                const fallbackKey = `${family}|400|${fontStyle}`;
                fontInfo = fontMap.get(fallbackKey);
            }

            return fontInfo;
        };

        elements.forEach(element => {
            if (element.textContent.trim()) {
                const style = window.getComputedStyle(element);
                const fontInfo = getFontInfoForElement(style);
                if (fontInfo) {
                    if (!matches.has(fontInfo.url)) {
                        matches.set(fontInfo.url, {
                            elements: new Set(),
                            variations: new Set()
                        });
                    }
                    matches.get(fontInfo.url).elements.add(element);
                    matches.get(fontInfo.url).variations.add(JSON.stringify({
                        family: fontInfo.family,
                        weight: fontInfo.weight,
                        style: fontInfo.style
                    }));
                }
            }

            ['::before', '::after'].forEach(pseudo => {
                const pseudoStyle = window.getComputedStyle(element, pseudo);
                if (pseudoStyle.content !== 'none' && pseudoStyle.content !== '""') {
                    const fontInfo = getFontInfoForElement(pseudoStyle);
                    if (fontInfo) {
                        if (!matches.has(fontInfo.url)) {
                            matches.set(fontInfo.url, {
                                elements: new Set(),
                                variations: new Set()
                            });
                        }
                        matches.get(fontInfo.url).elements.add(element);
                        matches.get(fontInfo.url).variations.add(JSON.stringify({
                            family: fontInfo.family,
                            weight: fontInfo.weight,
                            style: fontInfo.style
                        }));
                    }
                }
            });
        });

        return Object.fromEntries(
            Array.from(matches.entries()).map(([url, data]) => [
                url,
                {
                    elementCount: {
                        aboveFold: Array.from(data.elements).filter(el => this.isElementAboveFold(el)).length,
                        total: data.elements.size
                    },
                    variations: Array.from(data.variations).map(v => JSON.parse(v)),
                    elements: Array.from(data.elements)
                }
            ])
        );
    }

    /**
     * Retrieves the results of the font analysis, specifically the fonts used above the fold.
     * This method returns an array containing the URLs of the fonts used above the fold.
     * 
     * @returns {Array<string>} An array of URLs of the fonts used above the fold.
     */
    getResults() {
      return this.aboveTheFoldFonts;
    }
}

export default BeaconPreloadFonts;