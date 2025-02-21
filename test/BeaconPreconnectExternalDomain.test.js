import assert from 'assert';
import sinon from 'sinon';
import BeaconPreconnectExternalDomain from '../src/BeaconPreconnectExternalDomain.js';

describe('BeaconPreconnectExternalDomain', function () {
    let loggerMock, instance;

    beforeEach(function () {
        loggerMock = {
            logMessage: sinon.spy(),
        };

        global.document = {
            querySelectorAll: sinon.stub(),
        };

        global.location = { hostname: 'example.com' };

        const config = {
            preconnect_external_domain_exclusions: [
                { type: 'attribute', key: 'rel', value: 'nofollow' },
                { type: 'domain', value: 'excluded.com' },
            ],
            preconnect_external_domain_elements: ['script', 'link', 'iframe'],
        };

        instance = new BeaconPreconnectExternalDomain(config, loggerMock);
    });

    afterEach(function() {
        delete global.window;
        delete global.document;
    });

    it('should process elements and log matched and excluded items', async function () {
        document.querySelectorAll.returns([
            {
                src: 'https://valid.com/script.js',
                tagName: 'SCRIPT',
                getAttribute: (key) => null,
            },
            {
                src: 'https://another-valid.com/embed.js',
                tagName: 'IFRAME',
                getAttribute: (key) => null,
            },
        ]);

        await instance.run();

        assert(loggerMock.logMessage.calledOnce);
        assert.deepStrictEqual(instance.getMatchedItems(), [
            ['valid.com', 'script'],
            ['another-valid.com', 'iframe'],
        ]);
    });

    it('should exclude elements based on attribute rules', async function () {
        document.querySelectorAll.returns([
            {
                src: 'https://excluded.com/script.js',
                tagName: 'SCRIPT',
                getAttribute: (key) => (key === 'rel' ? 'nofollow' : null),
            },
        ]);

        await instance.run();

        assert(loggerMock.logMessage.calledOnce);
        assert.deepStrictEqual(instance.excludedItems, new Set([
            { domain: 'excluded.com', elementType: 'script', reason: 'rel=nofollow' },
        ]));
    });

    it('should exclude elements based on domain rules', async function () {
        document.querySelectorAll.returns([
            {
                src: 'https://excluded.com/script.js',
                tagName: 'SCRIPT',
                getAttribute: () => null,
            },
        ]);

        await instance.run();

        assert(loggerMock.logMessage.calledOnce);
        assert.deepStrictEqual(instance.excludedItems, new Set([
            { domain: 'excluded.com', elementType: 'script', reason: 'domain-partial=excluded.com' },
        ]));
    });
});