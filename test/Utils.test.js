import assert from 'assert';
import BeaconUtils from '../src/Utils.js';
import node_fetch from 'node-fetch';
global.fetch = node_fetch;

describe('BeaconManager', function() {

    describe('#isIntersecting', function() {
        beforeEach(function () {
            // Mock viewport size
            global.window = {
                innerWidth: 1024,
                innerHeight: 768
            };
        });

        it('should return true for a rectangle fully within the viewport', function () {
            const rect = {top: 100, left: 100, bottom: 200, right: 200};
            assert.strictEqual(BeaconUtils.isIntersecting(rect), true);
        });

        it('should return false for a rectangle entirely above the viewport', function () {
            const rect = {top: -500, left: 100, bottom: -400, right: 200};
            assert.strictEqual(BeaconUtils.isIntersecting(rect), false);
        });

        it('should return false for a rectangle entirely below the viewport', function () {
            const rect = {top: 800, left: 100, bottom: 900, right: 200};
            assert.strictEqual(BeaconUtils.isIntersecting(rect), false);
        });

        it('should return false for a rectangle entirely to the left of the viewport', function () {
            const rect = {top: 100, left: -500, bottom: 200, right: -400};
            assert.strictEqual(BeaconUtils.isIntersecting(rect), false);
        });

        it('should return false for a rectangle entirely to the right of the viewport', function () {
            const rect = {top: 100, left: 1100, bottom: 200, right: 1200};
            assert.strictEqual(BeaconUtils.isIntersecting(rect), false);
        });
    });

    describe('#isPageCached', function() {

        it('should return true when the page is cached', function() {

            global.document ={
                documentElement: {
                    nextSibling: {
                        data:'<!--Debug: cached-->'
                    }
                }
            };

            assert.strictEqual(BeaconUtils.isPageCached(), true);
        });

        it('should return false when the page is not cached', function() {
            global.document ={
                documentElement: {
                    nextSibling: {
                        data:'test'
                    }
                }
            };
            assert.strictEqual(BeaconUtils.isPageCached(), false);
        });
    });

});
