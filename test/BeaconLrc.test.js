import assert from 'assert';
import BeaconLrc from '../src/BeaconLrc.js';
import sinon from "sinon";

describe('BeaconLrc', function() {
    let beaconLrc;
    let mockElements;

    beforeEach(function() {
        mockElements = [
            {
                getBoundingClientRect: () => {
                    return {
                        top : 0,
                    };
                },
                getAttribute: () => 'hash1',
                hasAttribute: () => true,
                dataset: { rocketLocationHash: 'hash1' },
                children: []
            },
            {
                getBoundingClientRect: () => {
                    return {
                        top : 800,
                    };
                },
                getAttribute: () => 'hash2',
                hasAttribute: () => true,
                dataset: { rocketLocationHash: 'hash2' },
                children: []
            },
            {
                getBoundingClientRect: () => {
                    return {
                        top : 1000,
                    };
                },
                getAttribute: () => 'hash3',
                hasAttribute: () => true,
                dataset: { rocketLocationHash: 'hash3' },
                children: []
            },
            {
                getBoundingClientRect: () => {
                    return {
                        top : -300,
                    };
                },
                getAttribute: () => 'hash4',
                hasAttribute: () => true,
                dataset: { rocketLocationHash: 'hash4' },
                children: []
            },
        ];

        // Mocking document.querySelectorAll
        global.document = {
            querySelectorAll: (selector) => {
                if (selector === '[data-rocket-location-hash]') {
                    return mockElements;
                }
                return [];
            },
            documentElement: { scrollTop: 100 } // Ensure documentElement is part of the mock
        };

        const config = { skipStrings: ['memex'] };
        const logger = {
            logMessage: (message) => {
                console.log(`Log: ${message}`);
            },
            logColoredMessage: (message, color) => {
                console.log(`%c${message}`, `color: ${color}`);
            }
        };
        beaconLrc = new BeaconLrc(config, logger);

        // Mocking window.pageYOffset
        global.window = { pageYOffset: 100, innerHeight: 500 };

        if (typeof global.window.getComputedStyle !== 'function') {
            global.window.getComputedStyle = () => ({
                marginTop: '0px',
                marginRight: '0px',
                marginBottom: '0px',
                marginLeft: '0px',
                contentVisibility: 'visible',
                position: 'static',
                overflow: 'visible'
            });
        }
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
    });

    it('should return empty elements', function() {
        global.document = {
            querySelectorAll: () => {
                return [];
            },
        };
        const elements = beaconLrc._getLazyRenderElements();
        assert(Array.isArray(elements));
        assert.strictEqual(elements.length, 0);
    });

    it('should return valid elements with depth, distance, and hash', function() {
        const _getElementDepthStub = sinon.stub(beaconLrc, '_getElementDepth');
        _getElementDepthStub.returns(1);

        const _skipElementStub = sinon.stub(beaconLrc, '_skipElement');
        _skipElementStub.withArgs(mockElements[2]).returns(true);
        _skipElementStub.withArgs(mockElements[3]).returns(true);

        const elements = beaconLrc._getLazyRenderElements();
        assert(Array.isArray(elements));
        assert.strictEqual(elements.length, 2);

        assert.strictEqual(elements[0].hash, 'hash1');
        assert.strictEqual(elements[0].depth, 1);
        assert.strictEqual(elements[0].distance, 0);

        assert.strictEqual(elements[1].hash, 'hash2');
        assert.strictEqual(elements[1].depth, 1);
        assert.strictEqual(elements[1].distance, 400);

        _getElementDepthStub.restore();
        _skipElementStub.restore();
    });

    it('should skip elements based on config skipStrings', function() {
        const _getElementDepthStub = sinon.stub(beaconLrc, '_getElementDepth');
        _getElementDepthStub.returns(1);

        const _skipElementStub = sinon.stub(beaconLrc, '_skipElement');
        _skipElementStub.withArgs(mockElements[2]).returns(true);
        _skipElementStub.withArgs(mockElements[3]).returns(true);

        const elements = beaconLrc._getLazyRenderElements();
        const skippedElement = elements.find(el => el.hash === 'hash3');
        assert.strictEqual(skippedElement, undefined);

        _getElementDepthStub.restore();
        _skipElementStub.restore();
    });

    it('should return correct distance', () => {
        const distance = beaconLrc._getElementDistance(mockElements[2]);
        assert.strictEqual(distance, 600);
    });

    it('should return 0 if distance is negative', () => {
        const distance = beaconLrc._getElementDistance(mockElements[3]);
        assert.strictEqual(distance, 0);
    });

    it('should return correct depth', () => {
        const elementWithNoParent = {
            parentElement: null,
        };
        assert.strictEqual(beaconLrc._getElementDepth(elementWithNoParent), 0);

        const elementWithoneParent = {
            parentElement: {
                tagName: 'DIV',
            },
        };
        assert.strictEqual(beaconLrc._getElementDepth(elementWithoneParent), 1);

        const elementWithTwoLevels = {
            parentElement: {
                tagName: 'DIV',
                parentElement: {
                    tagName: 'DIV',
                },
            },
        };
        assert.strictEqual(beaconLrc._getElementDepth(elementWithTwoLevels), 2);
    });

    it('_skipElement', () => {
        // Empty config
        const configStub = sinon.stub(beaconLrc, 'config');
        configStub.value({});
        assert.strictEqual(beaconLrc._skipElement({id: 'anyid'}), false);

        // Empty element
        assert.strictEqual(beaconLrc._skipElement(), false);

        // Custom config
        configStub.value({skipStrings: ['anyid', 'customid']});
        assert.strictEqual(beaconLrc._skipElement({id: 'anyid'}), true);

        // Case-insensitive
        configStub.value({skipStrings: ['aNyid', 'customid']});
        assert.strictEqual(beaconLrc._skipElement({id: 'AnyId'}), true);

        configStub.restore();
    });

    it('run with empty elements', async () => {
        const beaconMock = sinon.mock(beaconLrc);

        // Empty elements
        beaconMock.expects("_getLazyRenderElements").returns('');
        beaconMock.expects("_processElements").withArgs('').never();
        await beaconLrc.run();

        beaconMock.restore();
    });

    it('run with thrown errors', async () => {
        const beaconMock = sinon.mock(beaconLrc);

        // Throws error
        beaconMock.expects("_getLazyRenderElements").throws('test error');
        beaconMock.expects("_processElements").never();
        await beaconLrc.run();
        beaconMock.verify();

        beaconMock.restore();
    });

    it('run with valid elements', async () => {
        const beaconMock = sinon.mock(beaconLrc);

        // Valid elements
        beaconMock.expects("_getLazyRenderElements").returns(['test']);
        beaconMock.expects("_processElements").withArgs(['test']).once();
        await beaconLrc.run();

        beaconMock.restore();
    });

    it('_getXPath', () => {
        const _getElementXPathStub = sinon.stub(beaconLrc, '_getElementXPath');
        _getElementXPathStub.returns('test');

        // No element
        assert.strictEqual(beaconLrc._getXPath(), 'test');

        // No ID
        assert.strictEqual(beaconLrc._getXPath({id: 'testID'}), '//*[@id="testID"]');

        _getElementXPathStub.restore();
    });

    it('should detect conflict when element has negative margins', () => {
        const element = mockElements[0];

        sinon.stub(window, 'getComputedStyle').callsFake(() => ({
            marginTop: '-10px',
            marginRight: '0px',
            marginBottom: '0px',
            marginLeft: '0px',
            contentVisibility: 'visible',
            position: 'static',
            overflow: 'visible'
        }));

        const result = beaconLrc._checkLcrConflict(element);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].conflicts.includes('negative margin'), true);
        window.getComputedStyle.restore();
    });

    it('should detect conflict when content visibility is hidden', () => {
        const element = mockElements[0];

        sinon.stub(window, 'getComputedStyle').callsFake(() => ({
            marginTop: '0px',
            marginRight: '0px',
            marginBottom: '0px',
            marginLeft: '0px',
            contentVisibility: 'hidden',
            position: 'static',
            overflow: 'visible'
        }));

        const result = beaconLrc._checkLcrConflict(element);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].conflicts.includes('content-visibility:hidden'), true);
        window.getComputedStyle.restore();
    });

    it('should detect conflict when child has negative margins', () => {
        const element = mockElements[0];

        const child = {
            getBoundingClientRect: () => ({ top: 500 }),
            getAttribute: () => null,
            hasAttribute: () => false,
            children: []
        };
        element.children = [child];

        sinon.stub(window, 'getComputedStyle')
            .onCall(0).returns({
            marginTop: '0px',
            marginRight: '0px',
            marginBottom: '0px',
            marginLeft: '0px',
            contentVisibility: 'visible',
            position: 'static',
            overflow: 'visible'
        })
            .onCall(1).returns({
            marginTop: '-20px',
            marginRight: '0px',
            marginBottom: '0px',
            marginLeft: '0px',
            contentVisibility: 'visible',
            position: 'absolute',
            overflow: 'visible'
        });

        const result = beaconLrc._checkLcrConflict(element);

        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].element, child);
        assert.strictEqual(result[0].conflicts.includes('negative margin'), true);

        window.getComputedStyle.restore();
    })
});