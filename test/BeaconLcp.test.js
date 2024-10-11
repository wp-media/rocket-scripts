import assert from 'assert';
import BeaconLcp from '../src/BeaconLcp.js';
import node_fetch from 'node-fetch';
import sinon from 'sinon';
global.fetch = node_fetch;

describe('BeaconManager', function() {
    let beacon,
        mockLogger;

    const config = { nonce: 'test', url: 'http://example.com', is_mobile: false };
    beforeEach(function() {
        mockLogger = { logMessage: function(message) {} };

        beacon = new BeaconLcp(config, mockLogger);

        global.window = {};
        global.document = {};

        global.window.getComputedStyle = sinon.stub().returns({
            getPropertyValue: sinon.stub().returns('none'),
        });

        global.getComputedStyle = (element, pseudoElement) => {
            return {
                getPropertyValue: (prop) => {
                    if (prop === "background-image") {
                        return "none";
                    }
                    return "";
                }
            };
        };
    });

    afterEach(function () {
        sinon.restore();
        delete global.window;
    });

    describe('#constructor()', function() {
        it('should initialize with the given config', function() {
            assert.deepStrictEqual(beacon.config, config);
        });
    });

    describe('#_isDuplicateImage()', function() {
        it('should return true for a duplicate image', function() {
            beacon.performanceImages = [{ src: 'http://example.com/image.jpg', nodeName:'img', type:'img' }];
            const image = { src: 'http://example.com/image.jpg', nodeName:'img', type:'img' };
            assert.strictEqual(beacon._isDuplicateImage(image), true);
        });

        it('should return false for a unique image', function() {
            beacon.performanceImages = [{ src: 'http://example.com/image.jpg', nodeName:'img', type:'img' }];
            const image = { src: 'http://example.com/unique.jpg', nodeName:'img', type:'img' };
            assert.strictEqual(beacon._isDuplicateImage(image), false);
        });
    });

    describe('#_initWithFirstElementWithInfo()', function() {
        it('should initialize performanceImages with the first valid element info', function() {
            const elements = [
                { element: { nodeName: 'div' }, elementInfo: null }, // invalid, no elementInfo
                { element: { nodeName: 'img', src: 'http://example.com/image1.jpg' }, elementInfo: { type: 'img', src: 'http://example.com/image1.jpg' } },
                { element: { nodeName: 'img', src: 'http://example.com/image2.jpg' }, elementInfo: { type: 'img', src: 'http://example.com/image2.jpg' } },
            ];

            beacon._initWithFirstElementWithInfo(elements);

            assert.strictEqual(beacon.performanceImages.length, 1);
            assert.strictEqual(beacon.performanceImages[0].src, 'http://example.com/image1.jpg');
            assert.strictEqual(beacon.performanceImages[0].label, 'lcp');
        });

        it('should not initialize performanceImages if no valid element info is found', function() {
            const elements = [
                { element: { nodeName: 'div' }, elementInfo: null },
                { element: { nodeName: 'div' }, elementInfo: null },
            ];

            beacon._initWithFirstElementWithInfo(elements);

            assert.strictEqual(beacon.performanceImages.length, 0);
        });
    });

    describe('#_getElementInfo()', function() {
        it('should return null when there are no valid background images', function() {
            const element = {
                nodeName: 'div'
            };

            const elementInfo = beacon._getElementInfo(element);

            assert.strictEqual(elementInfo, null);
        });
    });
});
