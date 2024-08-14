import assert from 'assert';
import sinon from 'sinon';
import BeaconLcp from '../src/BeaconLcp.js';
import node_fetch from 'node-fetch';
global.fetch = node_fetch;

describe('BeaconManager', function() {
    let beacon;
    const config = { nonce: 'test', url: 'http://example.com', is_mobile: false };
    beforeEach(function() {
        beacon = new BeaconLcp(config);
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

});
