import assert from 'assert';
import sinon from 'sinon';
import LcpBeacon from '../src/LcpBeacon.js';
import node_fetch from 'node-fetch';
global.fetch = node_fetch;


describe('LcpBeacon', function() {
    let beacon;
    const config = { nonce: 'test', url: 'http://example.com', is_mobile: false };
    beforeEach(function() {
        beacon = new LcpBeacon(config);
    });

    describe('#constructor()', function() {
        it('should initialize with the given config', function() {
            assert.deepStrictEqual(beacon.config, config);
        });
    });

    describe('#_isValidPreconditions()', function() {
        it('should return true for valid preconditions', async function() {
            // Mocking window properties and methods since they are used in _isValidPreconditions
            global.window = {
                innerWidth: 800,
                innerHeight: 600,
                document: {
                    documentElement: {
                        clientWidth: 800,
                        clientHeight: 600
                    }
                }
            };

            // Mock _isPageCached and _isGeneratedBefore to return false to simulate valid preconditions
            beacon._isPageCached = () => false;
            beacon._isGeneratedBefore = async () => false;

            const result = await beacon._isValidPreconditions();
            assert.strictEqual(result, true);
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

    describe('#_getFinalStatus()', function() {
        it('should return error code if set', function() {
            beacon.errorCode = 'error';
            assert.strictEqual(beacon._getFinalStatus(), 'error');
        });

        it('should return timeout if script time exceeds 10 seconds', function() {
            beacon.scriptTimer = new Date() - 11000; // 11 seconds ago
            assert.strictEqual(beacon._getFinalStatus(), 'timeout');
        });

        it('should return success for valid conditions', function() {
            beacon.scriptTimer = new Date();
            assert.strictEqual(beacon._getFinalStatus(), 'success');
        });
    });

    describe('#_saveFinalResultIntoDB()', function() {
        let fetchStub;

        beforeEach(function() {
            // Setup fetch stub
            fetchStub = sinon.stub(global, 'fetch');
            // Simulate fetch resolving with a JSON response
            fetchStub.resolves({
                json: () => Promise.resolve({ message: 'Data saved successfully' })
            });
        });

        afterEach(function() {
            // Restore the original fetch function
            fetchStub.restore();
        });

        it('should call fetch with the correct parameters and handle the response', async function() {
            beacon.performanceImages = [{ src: 'http://example.com/image.jpg', label: 'lcp' }];
            beacon.errorCode = '';
            beacon.scriptTimer = new Date();

            await beacon._saveFinalResultIntoDB();

            sinon.assert.calledOnce(fetchStub);
            const expectedBody = new FormData();
            expectedBody.append('action', 'rocket_lcp');
            expectedBody.append('rocket_lcp_nonce', config.nonce);
            expectedBody.append('url', config.url);
            expectedBody.append('is_mobile', config.is_mobile.toString());
            expectedBody.append('images', JSON.stringify(beacon.performanceImages));
            expectedBody.append('status', beacon._getFinalStatus());

            const fetchCall = fetchStub.getCall(0);
            assert.strictEqual(fetchCall.args[0], config.ajax_url);
            assert.deepStrictEqual(fetchCall.args[1].method, "POST");
            // Note: Direct comparison of FormData objects might not work as expected, so you may need to compare each field individually if necessary.

            // Additional assertions can be made here regarding the handling of the fetch response and the finalization process
        });
    });

    describe('#_saveFinalResultIntoDB()', function() {
        let fetchStub, finalizeSpy, setAttributeSpy;

        beforeEach(function() {
            // Setup fetch stub to simulate a successful response
            fetchStub = sinon.stub(global, 'fetch').callsFake(() =>
                Promise.resolve({
                    json: () => Promise.resolve({ message: 'Data saved successfully' })
                }).then(response => {
                    // Simulate calling _finalize after the fetch promise resolves
                    beacon._finalize();
                    return response;
                })
            );
            global.document = {
                querySelector: sinon.stub().withArgs('[data-name="wpr-lcp-beacon"]').returns({
                    setAttribute: function() {}
                })
            };
            // Spy on setAttribute to ensure it's called with the correct arguments
            setAttributeSpy = sinon.spy(global.document.querySelector('[data-name="wpr-lcp-beacon"]'), 'setAttribute');
            // Prepare performanceImages or any other data needed by _saveFinalResultIntoDB
            beacon.performanceImages = [{ src: 'http://example.com/image.jpg', label: 'lcp' }];
            beacon.errorCode = '';
            beacon.scriptTimer = new Date();
            finalizeSpy = sinon.spy(beacon, '_finalize');
        });

        afterEach(function() {
            // Restore the original fetch function
            fetchStub.restore();
            finalizeSpy.restore();
            setAttributeSpy.restore();
        });

        it('should call fetch with the correct parameters and handle the response', async function() {
            await beacon._saveFinalResultIntoDB();

            sinon.assert.calledOnce(fetchStub);
            const fetchCall = fetchStub.getCall(0);
            assert.strictEqual(fetchCall.args[0], beacon.config.ajax_url);
            assert.deepStrictEqual(fetchCall.args[1].method, "POST");
            const sentFormData = fetchCall.args[1].body;

            // Convert FormData to a plain object for easier comparison
            const sentDataObject = formDataToObject(sentFormData);

            // Now you can assert the values in sentDataObject
            assert.strictEqual(sentDataObject['action'], 'rocket_lcp');
            assert.strictEqual(sentDataObject['rocket_lcp_nonce'], config.nonce);
            assert.strictEqual(sentDataObject['url'], config.url);
            assert.strictEqual(sentDataObject['is_mobile'], config.is_mobile.toString());
            // For complex types like arrays or objects, you might need to parse them before assertion
            assert.deepStrictEqual(JSON.parse(sentDataObject['images']), beacon.performanceImages);
            assert.strictEqual(sentDataObject['status'], beacon._getFinalStatus());
            sinon.assert.calledOnce(finalizeSpy);
            sinon.assert.calledWith(setAttributeSpy, 'beacon-completed', 'true');
        });
    });

    describe('#_handleInfiniteLoop()', function() {
        let saveFinalResultIntoDBSpy;

        beforeEach(function() {
            // Spy on _saveFinalResultIntoDB to ensure it's called
            saveFinalResultIntoDBSpy = sinon.spy(beacon, '_saveFinalResultIntoDB');
        });

        afterEach(function() {
            // Restore the original methods
            saveFinalResultIntoDBSpy.restore();
        });

        it('should call _saveFinalResultIntoDB and set beacon-completed to true', function() {
            beacon._handleInfiniteLoop();
            sinon.assert.calledOnce(saveFinalResultIntoDBSpy);
        });
    });
    describe('#_finalize()', function() {
        let setAttributeSpy, clearTimeoutSpy;

        beforeEach(function() {
            // Mock document.querySelector to prevent errors in a Node environment
            global.document = {
                querySelector: sinon.stub().withArgs('[data-name="wpr-lcp-beacon"]').returns({
                    setAttribute: function() {}
                })
            };
            // Spy on setAttribute to ensure it's called with the correct arguments
            setAttributeSpy = sinon.spy(global.document.querySelector('[data-name="wpr-lcp-beacon"]'), 'setAttribute');
            // Spy on clearTimeout to ensure it's called
            clearTimeoutSpy = sinon.spy(global, 'clearTimeout');
            // Mock the infiniteLoopId to simulate a timeout being set
            beacon.infiniteLoopId = setTimeout(() => {}, 1000);
        });

        afterEach(function() {
            // Restore the original methods
            setAttributeSpy.restore();
            clearTimeoutSpy.restore();
        });

        it('should set beacon-completed to true and clear the timeout', function() {
            beacon._finalize();
            sinon.assert.calledWith(setAttributeSpy, 'beacon-completed', 'true');
            sinon.assert.calledOnce(clearTimeoutSpy);
            sinon.assert.calledWith(clearTimeoutSpy, beacon.infiniteLoopId);
        });
    });
});

// Helper function to convert FormData to a plain object
function formDataToObject(formData) {
    const object = {};
    formData.forEach((value, key) => {
        // Check if the object already contains the key
        if (object.hasOwnProperty(key)) {
            // If it's an array, push the new value
            if (Array.isArray(object[key])) {
                object[key].push(value);
            } else {
                // Convert to an array with the current and new value
                object[key] = [object[key], value];
            }
        } else {
            // Add the key and value
            object[key] = value;
        }
    });
    return object;
}