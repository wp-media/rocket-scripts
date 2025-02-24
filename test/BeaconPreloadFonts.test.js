import assert from 'assert';
import sinon from 'sinon';
import BeaconPreloadFonts from '../src/BeaconPreloadFonts.js';

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
            documentElement: { scrollTop: 100 } // Mock scroll position
        };

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
});