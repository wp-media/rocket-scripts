import assert from 'assert';
import sinon from 'sinon';
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

    describe('#isElementVisible', () => {
        beforeEach(function () {
            // Mock DOM elements and getComputedStyle
            global.window = {
                ...global.window,
                getComputedStyle: sinon.stub()
            };
            
            global.document = {
                createElement: () => ({
                    getBoundingClientRect: () => ({
                        width: 100,
                        height: 100
                    })
                })
            };
        });

        afterEach(function () {
            if (global.window.getComputedStyle.restore) {
                global.window.getComputedStyle.restore();
            }
        });

        it('should return true for visible elements', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), true);
        });

        it('should return false for elements with display: none', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                display: 'none',
                visibility: 'visible',
                opacity: '1',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });

        it('should return false for elements with visibility: hidden', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'hidden',
                opacity: '1',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });

        it('should return false for elements with opacity: 0', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'visible',
                opacity: '0',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });

        it('should return false for elements with zero width', () => {
            const element = {
                getBoundingClientRect: () => ({
                    width: 0,
                    height: 100
                })
            };
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });

        it('should return false for elements with zero height', () => {
            const element = {
                getBoundingClientRect: () => ({
                    width: 100,
                    height: 0
                })
            };
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });

        it('should return false for elements with transparent text', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                display: 'block',
                visibility: 'visible',
                opacity: '1',
                color: 'transparent',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.isElementVisible(element), false);
        });
    });

    describe('#hasTransparentText', () => {
        beforeEach(function () {
            global.window = {
                ...global.window,
                getComputedStyle: sinon.stub()
            };
            
            global.document = {
                createElement: () => ({})
            };
        });

        afterEach(function () {
            if (global.window.getComputedStyle.restore) {
                global.window.getComputedStyle.restore();
            }
        });

        it('should return true for elements with color: transparent', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'transparent',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with rgba color with alpha 0', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgba(255, 0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with rgba color with alpha 0 and spaces', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgba(255, 128, 64, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with hsla color with alpha 0', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'hsla(120, 50%, 50%, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with 8-digit hex color ending in 00', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: '#ff000000',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with uppercase 8-digit hex color ending in 00', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: '#FF123A00',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return true for elements with filter: opacity(0)', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgb(0, 0, 0)',
                filter: 'blur(5px) opacity(0) brightness(100%)'
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), true);
        });

        it('should return false for elements with visible text properties', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgb(0, 0, 0)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });

        it('should return false for elements with rgba color with non-zero alpha', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgba(255, 0, 0, 0.5)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });

        it('should return false for elements with hsla color with non-zero alpha', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'hsla(120, 50%, 50%, 0.8)',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });

        it('should return false for elements with 8-digit hex color not ending in 00', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: '#ff0000ff',
                filter: ''
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });

        it('should return false for elements with filter: opacity(1)', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgb(0, 0, 0)',
                filter: 'blur(5px) opacity(1) brightness(100%)'
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });

        it('should return false for elements with no filter', () => {
            const element = global.document.createElement('div');
            
            global.window.getComputedStyle.returns({
                color: 'rgb(0, 0, 0)',
                filter: 'none'
            });
            
            assert.strictEqual(BeaconUtils.hasTransparentText(element), false);
        });
    });

});
