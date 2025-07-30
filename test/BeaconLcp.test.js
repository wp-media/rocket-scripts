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

    describe('#_generateLcpCandidates()', function() {
        let mockElements;
        
        beforeEach(function() {
            mockElements = [
                {
                    nodeName: 'IMG',
                    parentElement: { nodeName: 'div' },
                    getBoundingClientRect: () => ({
                        width: 300,
                        height: 200,
                        top: 0,
                        left: 0,
                        bottom: 200,
                        right: 300
                    })
                },
                {
                    nodeName: 'IMG',
                    parentElement: { nodeName: 'div' },
                    getBoundingClientRect: () => ({
                        width: 250,
                        height: 150,
                        top: 10,
                        left: 10,
                        bottom: 160,
                        right: 260
                    })
                },
                {
                    nodeName: 'IMG',
                    parentElement: { nodeName: 'div' },
                    getBoundingClientRect: () => ({
                        width: 200,
                        height: 100,
                        top: 20,
                        left: 20,
                        bottom: 120,
                        right: 220
                    })
                }
            ];

            global.document = {
                querySelectorAll: () => mockElements
            };

            global.window = {
                ...global.window,
                innerWidth: 1200,
                innerHeight: 800,
                getComputedStyle: sinon.stub()
            };

            // Mock BeaconUtils.isIntersecting to return true by default
            const UtilsStub = sinon.stub();
            UtilsStub.isIntersecting = sinon.stub().returns(true);
            beacon.constructor.Utils = UtilsStub;
        });

        afterEach(function() {
            sinon.restore();
        });

        it('should filter out elements with opacity: 0', function() {
            // Setup: first element has opacity 0, second is visible
            global.window.getComputedStyle
                .onCall(0).returns({ display: 'block', visibility: 'visible', opacity: '0', color: 'rgb(0,0,0)', filter: '' })
                .onCall(1).returns({ display: 'block', visibility: 'visible', opacity: '0', color: 'rgb(0,0,0)', filter: '' })
                .onCall(2).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(3).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(4).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(5).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' });

            beacon.config = { elements: 'img' };
            
            // Mock _getElementInfo to return valid info for visible elements
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Should only return 2 candidates (excluding the one with opacity: 0)
            assert.strictEqual(candidates.length, 2);
            assert.strictEqual(candidates[0].element, mockElements[1]);
            assert.strictEqual(candidates[1].element, mockElements[2]);
        });

        it('should filter out elements with visibility: hidden', function() {
            // Setup: first element has visibility hidden, others are visible
            global.window.getComputedStyle
                .onCall(0).returns({ display: 'block', visibility: 'hidden', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(1).returns({ display: 'block', visibility: 'hidden', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(2).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(3).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(4).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(5).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' });

            beacon.config = { elements: 'img' };
            
            // Mock _getElementInfo to return valid info for visible elements
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Should only return 2 candidates (excluding the one with visibility: hidden)
            assert.strictEqual(candidates.length, 2);
            assert.strictEqual(candidates[0].element, mockElements[1]);
            assert.strictEqual(candidates[1].element, mockElements[2]);
        });

        it('should filter out elements with display: none', function() {
            // Setup: first element has display none, others are visible
            global.window.getComputedStyle
                .onCall(0).returns({ display: 'none', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(1).returns({ display: 'none', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(2).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(3).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(4).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(5).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' });

            beacon.config = { elements: 'img' };
            
            // Mock _getElementInfo to return valid info for visible elements
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Should only return 2 candidates (excluding the one with display: none)
            assert.strictEqual(candidates.length, 2);
            assert.strictEqual(candidates[0].element, mockElements[1]);
            assert.strictEqual(candidates[1].element, mockElements[2]);
        });

        it('should include elements with visible styles', function() {
            // All elements are visible
            global.window.getComputedStyle.returns({ display: 'block', visibility: 'visible', opacity: '1' });

            beacon.config = { elements: 'img' };
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            assert.strictEqual(candidates.length, 3);
            // Should be sorted by area (largest first)
            assert.strictEqual(candidates[0].element, mockElements[0]); // 300x200 = 60000
            assert.strictEqual(candidates[1].element, mockElements[1]); // 250x150 = 37500
            assert.strictEqual(candidates[2].element, mockElements[2]); // 200x100 = 20000
        });

        it('should handle multiple hidden elements with different visibility issues', function() {
            // Mix of visibility issues
            global.window.getComputedStyle
                .onCall(0).returns({ display: 'none', visibility: 'visible', opacity: '1' })    // hidden by display
                .onCall(1).returns({ display: 'block', visibility: 'hidden', opacity: '1' })    // hidden by visibility
                .onCall(2).returns({ display: 'block', visibility: 'visible', opacity: '0' });  // hidden by opacity

            beacon.config = { elements: 'img' };
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // All elements should be filtered out
            assert.strictEqual(candidates.length, 0);
        });

        it('should handle edge case with very low opacity but not zero', function() {
            // Test with very low opacity (0.01) - should be included as it's not exactly 0
            global.window.getComputedStyle
                .onCall(0).returns({ display: 'block', visibility: 'visible', opacity: '0.01', color: 'rgb(0,0,0)', filter: '' })
                .onCall(1).returns({ display: 'block', visibility: 'visible', opacity: '0.01', color: 'rgb(0,0,0)', filter: '' })
                .onCall(2).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(3).returns({ display: 'block', visibility: 'visible', opacity: '1', color: 'rgb(0,0,0)', filter: '' })
                .onCall(4).returns({ display: 'block', visibility: 'visible', opacity: '0', color: 'rgb(0,0,0)', filter: '' })
                .onCall(5).returns({ display: 'block', visibility: 'visible', opacity: '0', color: 'rgb(0,0,0)', filter: '' });

            beacon.config = { elements: 'img' };
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Should include elements with opacity 0.01 and 1, but not 0
            assert.strictEqual(candidates.length, 2);
            assert.strictEqual(candidates[0].element, mockElements[0]);
            assert.strictEqual(candidates[1].element, mockElements[1]);
        });

        it('should maintain existing functionality for elements with zero dimensions', function() {
            // Test that elements with zero width/height are still filtered out
            mockElements[0].getBoundingClientRect = () => ({
                width: 0,
                height: 200,
                top: 0,
                left: 0,
                bottom: 200,
                right: 0
            });

            global.window.getComputedStyle.returns({ display: 'block', visibility: 'visible', opacity: '1' });

            beacon.config = { elements: 'img' };
            sinon.stub(beacon, '_getElementInfo').returns({ src: 'test.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Should exclude element with zero width
            assert.strictEqual(candidates.length, 2);
            assert.strictEqual(candidates[0].element, mockElements[1]);
            assert.strictEqual(candidates[1].element, mockElements[2]);
        });

        it('should reproduce and fix the belivria.com bug scenario', function() {
            // Simulate the belivria.com scenario from the bug report
            const hiddenImage = {
                nodeName: 'IMG',
                src: 'test_inline2.jpeg',
                parentElement: { nodeName: 'div' },
                getBoundingClientRect: () => ({
                    width: 350,
                    height: 350,
                    top: 50,
                    left: 50,
                    bottom: 400,
                    right: 400
                })
            };

            const visibleImage = {
                nodeName: 'IMG', 
                src: 'img_nature.jpg',
                parentElement: { nodeName: 'div' },
                getBoundingClientRect: () => ({
                    width: 350,
                    height: 350,
                    top: 50,
                    left: 50,
                    bottom: 400,
                    right: 400
                })
            };

            global.document.querySelectorAll = () => [hiddenImage, visibleImage];

            // Mock computed styles - hidden image has opacity: 0, visible image has opacity: 1
            global.window.getComputedStyle
                .withArgs(hiddenImage).returns({ display: 'block', visibility: 'visible', opacity: '0' })
                .withArgs(visibleImage).returns({ display: 'block', visibility: 'visible', opacity: '1' });

            beacon.config = { elements: 'img' };

            // Mock _getElementInfo to return valid image info
            sinon.stub(beacon, '_getElementInfo')
                .withArgs(hiddenImage).returns({ src: 'test_inline2.jpeg', type: 'img' })
                .withArgs(visibleImage).returns({ src: 'img_nature.jpg', type: 'img' });

            const candidates = beacon._generateLcpCandidates(10);

            // Before fix: would return hiddenImage as first candidate due to DOM order
            // After fix: should only return visibleImage
            assert.strictEqual(candidates.length, 1);
            assert.strictEqual(candidates[0].element, visibleImage);
            assert.strictEqual(candidates[0].elementInfo.src, 'img_nature.jpg');

            // Verify the hidden image is not in candidates
            const hiddenImageCandidate = candidates.find(c => c.element === hiddenImage);
            assert.strictEqual(hiddenImageCandidate, undefined);
        });
    });
});
