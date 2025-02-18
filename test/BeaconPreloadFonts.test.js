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
            querySelectorAll: (selector) => {
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
});