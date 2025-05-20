import assert from 'assert';
import sinon from 'sinon';
import BeaconPreloadFonts from '../src/BeaconPreloadFonts.js';

// Helper function to create mock CSSFontFaceRule objects
const createMockFontFaceRule = (fontFamily, src, weight, style) => {
    // Create an actual instance that passes the instanceof check
    const rule = Object.create(CSSFontFaceRule.prototype);
    
    // Add the style property with getPropertyValue method
    rule.style = {
      getPropertyValue: function(prop) {
        switch(prop) {
          case 'font-family': return `'${fontFamily}'`;
          case 'src': return src;
          case 'font-weight': return weight;
          case 'font-style': return style;
          default: return '';
        }
      }
    };
    
    return rule;
  }

describe('BeaconPreloadFonts', () => {
    let beaconPreloadFonts;
    let loggerMock;

    beforeEach(() => {
        loggerMock = {
            logMessage: sinon.spy()
        };
        const config = {
            system_fonts: ['Arial', 'Helvetica'],
            font_data: {}
        };

        // Initialize the class with mock config and logger
        beaconPreloadFonts = new BeaconPreloadFonts(config, loggerMock);

        // Mocking the document object
        global.document = {
            createElement: (tagName) => {
                return {
                    tagName,
                    style: {},
                    getBoundingClientRect: () => ({ top: 0, height: 100, width: 100 }),
                    appendChild: function() {},
                    removeChild: function() {}
                };
            },
            querySelectorAll: () => {
                return []; // Return an empty array for any selector
            },
            body: {
                appendChild: function() {},
                removeChild: function() {}
            },
            getElementsByTagName: sinon.stub().returns([
                {
                    style: { fontFamily: 'CustomFont' },
                    textContent: 'Test Content',
                    getBoundingClientRect: () => ({ top: 0, height: 100, width: 100 }) // Mocking getBoundingClientRect
                },
                {
                    style: { fontFamily: 'SystemFont' },
                    textContent: 'System Font Content',
                    getBoundingClientRect: () => ({ top: 50, height: 100, width: 100 }) // Mocking getBoundingClientRect
                }
            ]),
            documentElement: { scrollTop: 100 }, // Mock scroll position
            fonts: {
                ready: function () {}
            }
        };

        global.CSSFontFaceRule = function() {};

        // Mocking the DOM elements and their styles
        document.body.innerHTML = `
            <div style="font-family: 'CustomFont';">Test Content</div>
            <div style="font-family: 'SystemFont';">System Font Content</div>
        `;

        // Mocking window.getComputedStyle
        global.window = {
            getComputedStyle: (element) => {
                return {
                    display: element.style.display || 'block',
                    visibility: element.style.visibility || 'visible',
                    opacity: element.style.opacity || '1',
                    // Add any other styles you need to mock
                };
            }
        };
    });

    afterEach(() => {
        // Clean up the global document mock
        delete global.document;
        delete global.window; // Clean up the global window mock
        sinon.restore(); // Restore sinon mocks
    });

    describe('isSystemFont', () => {
        it('should return true for system fonts', () => {
            assert.strictEqual(beaconPreloadFonts.isSystemFont('Arial'), true);
        });

        it('should return false for non-system fonts', () => {
            assert.strictEqual(beaconPreloadFonts.isSystemFont('Times New Roman'), false);
        });
    });

    describe('isElementVisible', () => {
        it('should return true for visible elements', () => {
            const element = document.createElement('div');
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
            assert.strictEqual(beaconPreloadFonts.isElementVisible(element), true);
        });

        it('should return false for hidden elements', () => {
            const element = document.createElement('div');
            element.style.display = 'none';
            assert.strictEqual(beaconPreloadFonts.isElementVisible(element), false);
        });
    });

    describe('cleanUrl', () => {
        it('should clean the URL correctly', () => {
            const url = 'http://example.com/font.woff2?query=123#fragment';
            const cleanedUrl = beaconPreloadFonts.cleanUrl(url);
            assert.strictEqual(cleanedUrl, 'http://example.com/font.woff2');
        });

        it('should return the original URL if it fails to parse', () => {
            const url = 'invalid-url';
            const cleanedUrl = beaconPreloadFonts.cleanUrl(url);
            assert.strictEqual(cleanedUrl, url);
        });
    });

    describe('isElementAboveFold', () => {
        it('isElementAboveFold should return true for visible elements above the fold', () => {
            // Create a mock element
            const element = document.createElement('div');
            document.body.appendChild(element);
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.getBoundingClientRect = sinon.stub().returns({
                top: 0,
                height: 100,
                width: 100,
            });
    
            // Mock window properties
            Object.defineProperty(window, 'innerHeight', { value: 200 });
            Object.defineProperty(window, 'pageYOffset', { value: 0 });
    
            assert.strictEqual(beaconPreloadFonts.isElementAboveFold(element), true);
    
            // Clean up
            document.body.removeChild(element);
        });
    
        it('isElementAboveFold should return false for hidden elements', () => {
            // Create a mock element
            const element = document.createElement('div');
            document.body.appendChild(element);
            element.style.display = 'none';
    
            assert.strictEqual(beaconPreloadFonts.isElementAboveFold(element), false);
    
            // Clean up
            document.body.removeChild(element);
        });
    
        it('isElementAboveFold should return false for elements below the fold', () => {
            // Create a mock element
            const element = document.createElement('div');
            document.body.appendChild(element);
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.getBoundingClientRect = sinon.stub().returns({
                top: 300,
                height: 100,
                width: 100,
            });
    
            // Mock window properties
            Object.defineProperty(window, 'innerHeight', { value: 200 });
            Object.defineProperty(window, 'pageYOffset', { value: 0 });
    
            assert.strictEqual(beaconPreloadFonts.isElementAboveFold(element), false);
    
            // Clean up
            document.body.removeChild(element);
        });
    });

    describe('run', () => {
        it('should log no fonts found if no fonts are above the fold', async () => {
            // Mock methods
            sinon.stub(beaconPreloadFonts, 'getNetworkLoadedFonts').returns(new Map());
            sinon.stub(beaconPreloadFonts, 'getFontFaceRules').returns({});
            sinon.stub(beaconPreloadFonts, 'processExternalFonts').returns({});

            await beaconPreloadFonts.run();

            assert.ok(loggerMock.logMessage.calledWith('No fonts found above the fold.'));
        });

        it('should log above the fold fonts when they are found', async () => {
            // Mock methods
            const mockFonts = {
                allFonts: {
                    'Font1': { variations: [{ url: 'http://example.com/font1.woff' }] }
                },
                externalFonts: {},
                hostedFonts: {}
            };
            sinon.stub(beaconPreloadFonts, 'getNetworkLoadedFonts').returns(new Map());
            sinon.stub(beaconPreloadFonts, 'getFontFaceRules').returns({});
            sinon.stub(beaconPreloadFonts, 'processExternalFonts').returns({});
            sinon.stub(beaconPreloadFonts, 'summarizeMatches').returns(mockFonts);

            await beaconPreloadFonts.run();

            assert.ok(loggerMock.logMessage.calledWith('Above the fold fonts:', mockFonts));
        });
    });

    describe('summarizeMatches', () => {
        it('should summarize hosted and external fonts correctly', () => {
            const externalFontsResults = {
                'http://example.com/font1.woff': {
                    elementCount: { aboveFold: 1, total: 1 },
                    variations: [{ family: 'Font1', weight: '400', style: 'normal' }],
                    elements: [document.createElement('div')]
                }
            };

            const hostedFonts = new Map();
            hostedFonts.set('Font2', {
                variations: [{ weight: '400', style: 'normal' }],
                elements: new Set([document.createElement('div')]),
                urls: ['http://example.com/font2.woff']
            });

            // Mock the isElementAboveFold method to return true for the hosted font element
            sinon.stub(beaconPreloadFonts, 'isElementAboveFold').callsFake(() => {
                return true; // Assume all elements are above the fold for this test
            });

            const networkLoadedFonts = new Map();
            networkLoadedFonts.set('http://example.com/font2.woff', 'http://example.com/font2.woff');

            const result = beaconPreloadFonts.summarizeMatches(externalFontsResults, hostedFonts, networkLoadedFonts);

            assert.deepEqual(result.externalFonts, {
                'http://example.com/font1.woff': externalFontsResults['http://example.com/font1.woff']
            });
            assert.deepEqual(result.hostedFonts['Font2'].variations[0], {
                weight: '400',
                style: 'normal',
                url: 'http://example.com/font2.woff',
                elementCount: { aboveFold: 1, belowFold: 0, total: 1 }
            });
            assert.ok(loggerMock.logMessage.notCalled);
        });
    });

    describe('processExternalFonts', () => {
        it('should process external font pairs correctly', async () => {
            const fontPairs = {
                'https://example.com/font1.woff2': [
                    { family: 'Font1', weight: '400', style: 'normal' },
                ],
                'https://example.com/font2.woff2': [
                    { family: 'Font2', weight: '400', style: 'normal' }
                ]
            };

            // Mocking the DOM elements
            const element = document.createElement('div');
            element.textContent = 'Test content';
            document.body.appendChild(element);

            // Mock the isElementAboveFold method to return true for the hosted font element
            let callCount = 0;
            sinon.stub(beaconPreloadFonts, 'isElementAboveFold').callsFake(() => {
                callCount++; // Increment the counter on each call
                return callCount === 1; // Return true only for the first call
            });

            // Mocking the getComputedStyle method
            sinon.stub(window, 'getComputedStyle').returns({
                fontFamily: 'Font1, sans-serif',
                fontWeight: '400',
                fontStyle: 'normal'
            });

            const result = await beaconPreloadFonts.processExternalFonts(fontPairs);

            // Assertions
            assert.strictEqual(typeof result, 'object', 'Result should be an object');
            assert.ok(result['https://example.com/font1.woff2'], 'Result should contain font1');
            assert.strictEqual(result['https://example.com/font1.woff2'].elementCount.total, 1, 'Font1 should have total count of 1');

            // Clean up
            document.body.removeChild(element);
            window.getComputedStyle.restore();
        });
    });

    describe('getResults', () => {
        it('should return an array with no duplicate URLs from getResults', async () => {
            sinon.stub(beaconPreloadFonts, 'getNetworkLoadedFonts').returns(new Map());
            sinon.stub(beaconPreloadFonts, 'getFontFaceRules').returns({});
            sinon.stub(beaconPreloadFonts, 'processExternalFonts').returns({});
    
            // Stub the summarizeMatches method to control its output
            const summarizeMatchesStub = sinon.stub(beaconPreloadFonts, 'summarizeMatches').returns({
                externalFonts: {},
                hostedFonts: {},
                allFonts: {
                    'Font1': {
                        variations: [{ url: 'https://example.com/font1.woff2' }],
                    },
                    'Font2': {
                        variations: [{ url: 'https://example.com/font2.woff2' }],
                    },
                    'Font3': {
                        variations: [{ url: 'https://example.com/font1.woff2' }], // Duplicate URL
                    },
                }
            });
    
            await beaconPreloadFonts.run();
            const results = beaconPreloadFonts.getResults();
            
            // Check for duplicates
            const uniqueResults = [...new Set(results)];
            assert.deepEqual(results, uniqueResults, 'The results contain duplicate URLs');
    
            // Restore the stub
            summarizeMatchesStub.restore();
        });
    });

    describe('getFontFaceRules', () => {
        it('should return an empty object when no stylesheets exist', function() {
            document.styleSheets = [];
            const result = beaconPreloadFonts.getFontFaceRules();
            assert.deepStrictEqual(result, {});
        });
        
        it('should process multiple font-face rules correctly', function() {
            // Create mock stylesheets with font-face rules
            const mockCSSFontFaceRule1 = createMockFontFaceRule('Roboto', 'url("fonts/roboto.woff2")', '700', 'normal');
            const mockCSSFontFaceRule2 = createMockFontFaceRule('Roboto', 'url("fonts/roboto-italic.woff2")', '700', 'italic');
            const mockCSSFontFaceRule3 = createMockFontFaceRule('Open Sans', 'url("fonts/opensans.woff2")', '400', 'normal');
            
            const mockStyleSheet = {
                href: null,
                cssRules: [
                mockCSSFontFaceRule1,
                { type: 1 }, // Some other rule type
                mockCSSFontFaceRule2,
                mockCSSFontFaceRule3
                ]
            };
            
            document.styleSheets = [mockStyleSheet];

            beaconPreloadFonts.cleanUrl = sinon.stub().callsFake(url => url.split('?')[0]);
            
            const result = beaconPreloadFonts.getFontFaceRules();
            console.log('result', result);
            
            // Verify correct parsing
            assert.strictEqual(Object.keys(result).length, 2, 'Should have two font families');
            
            // Check Roboto data
            assert.ok(result['Roboto'], 'Should have Roboto font');
            assert.strictEqual(result['Roboto'].urls.length, 2, 'Roboto should have 2 URLs');
            assert.strictEqual(result['Roboto'].variations.length, 2, 'Roboto should have 2 variations');
            
            // Check Open Sans data
            assert.ok(result['Open Sans'], 'Should have Open Sans font');
            assert.strictEqual(result['Open Sans'].urls.length, 1, 'Open Sans should have 1 URL');
            
            // Verify cleanUrl was called
            assert.ok(beaconPreloadFonts.cleanUrl.called, 'cleanUrl should be called');
        });
        
        it('should handle multiple src URLs in one font-face rule', function() {
            const multipleSrcRule = createMockFontFaceRule(
                'MyCustomFont3', 
                'url("fonts/font.woff2") format("woff2"), url("fonts/font.woff") format("woff"), url("fonts/font.ttf") format("truetype")',
                'normal',
                'normal'
            );
            
            document.styleSheets = [{
                href: null,
                cssRules: [multipleSrcRule]
            }];
            
            const result = beaconPreloadFonts.getFontFaceRules();
            
            assert.ok(result['MyCustomFont3'], 'Should have MyCustomFont3');
            assert.strictEqual(result['MyCustomFont3'].urls.length, 3, 'Should extract all 3 URLs');
        });
        
        it('should convert relative URLs to absolute when stylesheet has href', function() {
            const fontFaceRule = createMockFontFaceRule('Arial', 'url("../fonts/arial.woff2")', '400', 'normal');
            
            document.styleSheets = [{
                href: 'https://example.com/css/styles.css',
                cssRules: [fontFaceRule]
            }];
            
            global.URL = sinon.stub().returns({
                href: 'https://example.com/fonts/arial.woff2'
            });
            
            const result = beaconPreloadFonts.getFontFaceRules();
            
            assert.strictEqual(result['Arial'].urls[0], 'https://example.com/fonts/arial.woff2', 
                                'Should convert relative URL to absolute');
        });
        
        it('should handle errors when accessing cross-origin stylesheets', function() {
            // Create a stylesheet that throws error when accessing cssRules
            const errorStyleSheet = {
                get cssRules() {
                throw new Error('Cannot access cssRules of cross-origin stylesheet');
                }
            };
            
            document.styleSheets = [errorStyleSheet];
            
            const result = beaconPreloadFonts.getFontFaceRules();
            
            // Should log error and return empty object
            assert.ok(beaconPreloadFonts.logger.logMessage.called, 'Should log the error');
            assert.deepStrictEqual(result, {}, 'Should return empty object on error');
        });
        
        it('should deduplicate URLs for the same font family', function() {
            // Create two rules with DIFFERENT URLs
            const rule1 = createMockFontFaceRule('Duplicate', 'url("fonts/normal.woff2")', '400', 'normal');
            const rule2 = createMockFontFaceRule('Duplicate', 'url("fonts/bold.woff2")', '700', 'normal');
            
            document.styleSheets = [{
              href: null,
              cssRules: [rule1, rule2]
            }];
            
            const result = beaconPreloadFonts.getFontFaceRules();
            
            assert.strictEqual(result['Duplicate'].urls.length, 2, 'Should have two different URLs');
            assert.strictEqual(result['Duplicate'].variations.length, 2, 'Should have two variations');
          });
    });

    describe('_initializeExternalFontSheets', () => {
        it('should set externalParsedSheets and externalParsedPairs from externalStylesheetsDoc', async () => {
            const mockSheets = [{ cssRules: [] }];
            const mockPairs = { 'https://fonts.example.com/font.woff2': [{ family: 'MockFont', weight: '400', style: 'normal' }] };
            const externalStylesheetsDocStub = sinon.stub(beaconPreloadFonts, 'externalStylesheetsDoc').resolves({
                styleSheets: mockSheets,
                fontPairs: mockPairs
            });

            await beaconPreloadFonts._initializeExternalFontSheets();

            assert.deepStrictEqual(beaconPreloadFonts.externalParsedSheets, mockSheets, 'externalParsedSheets should be set');
            assert.deepStrictEqual(beaconPreloadFonts.externalParsedPairs, mockPairs, 'externalParsedPairs should be set');
            assert.ok(loggerMock.logMessage.calledWith('Initializing external font stylesheets...'));
            assert.ok(loggerMock.logMessage.calledWith('Successfully parsed 1 external font stylesheets.'));

            externalStylesheetsDocStub.restore();
        });

        it('should handle errors and reset externalParsedSheets to empty array', async () => {
            const error = new Error('Test error');
            const externalStylesheetsDocStub = sinon.stub(beaconPreloadFonts, 'externalStylesheetsDoc').rejects(error);

            await beaconPreloadFonts._initializeExternalFontSheets();

            assert.deepStrictEqual(beaconPreloadFonts.externalParsedSheets, [], 'externalParsedSheets should be empty array on error');
            assert.ok(loggerMock.logMessage.calledWith('Error initializing external font stylesheets:', error));

            externalStylesheetsDocStub.restore();
        });
    });

    describe('externalStylesheetsDoc', () => {
        let originalQuerySelectorAll;
        let originalFetch;
        let originalCSSStyleSheet;
        beforeEach(() => {
            // Mock CSSRule.FONT_FACE_RULE
            global.CSSRule = { FONT_FACE_RULE: 5 };
            // Mock document.querySelectorAll to return fake link elements
            originalQuerySelectorAll = global.document.querySelectorAll;
            global.document.querySelectorAll = sinon.stub().returns([
                { href: 'https://fonts.googleapis.com/css?family=Roboto', rel: 'stylesheet' }
            ]);

            // Mock fetch to return a fake CSS response
            originalFetch = global.fetch;
            global.fetch = sinon.stub().resolves({
                ok: true,
                text: () => Promise.resolve('@font-face { font-family: "Roboto"; src: url("https://fonts.gstatic.com/s/roboto.woff2"); font-weight: 400; font-style: normal; }')
            });

            // Mock CSSStyleSheet and replaceSync
            originalCSSStyleSheet = global.CSSStyleSheet;
            global.CSSStyleSheet = function() {
                this.rules = [];
                this.replaceSync = function(cssText) {
                    // Simulate parsing CSS text into cssRules
                    this.cssRules = [{
                        type: 5, // CSSRule.FONT_FACE_RULE
                        style: {
                            getPropertyValue: (prop) => {
                                if (prop === 'font-family') return 'Roboto';
                                if (prop === 'src') return 'url("https://fonts.gstatic.com/s/roboto.woff2")';
                                if (prop === 'font-weight') return '400';
                                if (prop === 'font-style') return 'normal';
                                return '';
                            }
                        }
                    }];
                };
            };
        });

        afterEach(() => {
            global.document.querySelectorAll = originalQuerySelectorAll;
            global.fetch = originalFetch;
            global.CSSStyleSheet = originalCSSStyleSheet;
        });

        it('should fetch, parse, and return external font CSS as styleSheets and fontPairs', async () => {
            const result = await beaconPreloadFonts.externalStylesheetsDoc();
            // Should have one stylesheet with cssRules
            assert.strictEqual(result.styleSheets.length, 1);
            assert.ok(Array.isArray(result.styleSheets));
            // Should have fontPairs with the correct structure
            assert.ok(result.fontPairs['https://fonts.gstatic.com/s/roboto.woff2']);
            assert.deepStrictEqual(result.fontPairs['https://fonts.gstatic.com/s/roboto.woff2'][0], {
                family: 'Roboto',
                weight: '400',
                style: 'normal'
            });
        });

        it('should return empty arrays/objects if no external links are found', async () => {
            global.document.querySelectorAll = sinon.stub().returns([]);
            const result = await beaconPreloadFonts.externalStylesheetsDoc();
            assert.deepStrictEqual(result.styleSheets, []);
            assert.deepStrictEqual(result.fontPairs, {});
        });
    });
});