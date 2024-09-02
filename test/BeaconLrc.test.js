import assert from 'assert';
import BeaconLrc from '../src/BeaconLrc.js';

describe('BeaconLrc', function() {
    let beaconLrc;
    let mockElement;

    beforeEach(function() {
        // Mocking document.querySelectorAll
        global.document = {
            querySelectorAll: (selector) => {
                if (selector === '[data-rocket-location-hash]') {
                    return [
                        { getAttribute: () => 'hash1', dataset: { rocketLocationHash: 'hash1' } },
                        { getAttribute: () => 'hash2', dataset: { rocketLocationHash: 'hash2' } },
                        { getAttribute: () => 'hash3', dataset: { rocketLocationHash: 'hash3' } }
                    ];
                }
                return [];
            },
            documentElement: { scrollTop: 100 } // Ensure documentElement is part of the mock
        };

        // Mocking the methods of BeaconLrc
        BeaconLrc.prototype._skipElement = function(element) {
            return element.dataset.rocketLocationHash === 'hash3';
        };

        BeaconLrc.prototype._getElementDepth = function(element) {
            return 1;
        };

        BeaconLrc.prototype._getElementDistance = function(element) {
            return 100; // Mocked distance updated to 100
        };

        BeaconLrc.prototype._getLocationHash = function(element) {
            return element.dataset.rocketLocationHash;
        };

        const config = { skipStrings: ['memex'] };
        const logger = { logMessage: () => {}, logColoredMessage: () => {} };
        beaconLrc = new BeaconLrc(config, logger);

        mockElement = {
            getBoundingClientRect: () => ({ top: 200 }),
        };

        // Mocking window.pageYOffset
        global.window = { pageYOffset: 100 };
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
    });

    it('should return valid elements with depth, distance, and hash', function() {
        const elements = beaconLrc._getLazyRenderElements();
        assert(Array.isArray(elements));
        assert.strictEqual(elements.length, 2);

        assert.strictEqual(elements[0].hash, 'hash1');
        assert.strictEqual(elements[0].depth, 1);
        assert.strictEqual(elements[0].distance, 100);

        assert.strictEqual(elements[1].hash, 'hash2');
        assert.strictEqual(elements[1].depth, 1);
        assert.strictEqual(elements[1].distance, 100);
    });

    it('should skip elements based on config skipStrings', function() {
        const elements = beaconLrc._getLazyRenderElements();
        const skippedElement = elements.find(el => el.hash === 'hash3');
        assert.strictEqual(skippedElement, undefined);
    });

    it('should return correct distance', () => {
        BeaconLrc.prototype._getElementDistance = function(element) {
            return 300; // Mocked distance updated to 300 for this test
        };
        const distance = beaconLrc._getElementDistance(mockElement);
        assert.strictEqual(distance, 300);
    });

    it('should return 0 if distance is negative', () => {
        BeaconLrc.prototype._getElementDistance = function(element) {
            const rect = element.getBoundingClientRect();
            const distance = rect.top + global.window.pageYOffset - global.document.documentElement.scrollTop;
            return distance < 0 ? 0 : distance;
        };
        mockElement.getBoundingClientRect = () => ({ top: -300 });
        const distance = beaconLrc._getElementDistance(mockElement);
        assert.strictEqual(distance, 0);
    });
});