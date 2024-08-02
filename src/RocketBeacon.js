'use strict';

import RocketLcpBeacon from "./RocketLcpBeacon.js";

class RocketBeacon {
    constructor(config) {
        this.config = config;
        this.lcpBeacon = null;
        this.infiniteLoopId = null;
        this.scriptTimer = new Date();
        this.errorCode = '';
    }

    async init() {
        if (!await this._isValidPreconditions()) {
            this._finalize();
            return;
        }

        this.infiniteLoopId = setTimeout(() => {
            this._handleInfiniteLoop();
        }, 10000);

        const isGeneratedBefore = await this._isGeneratedBefore();

        if (!isGeneratedBefore.lcp) {
            this.lcpBeacon = new RocketLcpBeacon(this.config);
            await this.lcpBeacon.run();
        }

        this._saveFinalResultIntoDB();
    }

    async _isValidPreconditions() {
        if (this._isNotValidScreensize()) {
            this._logMessage('Bailing out because screen size is not acceptable');
            return false;
        }

        if (this._isPageCached() && await this._isGeneratedBefore()) {
            this._logMessage('Bailing out because data is already available');
            return false;
        }

        return true;
    }

    _isPageCached() {
        const signature = document.documentElement.nextSibling && document.documentElement.nextSibling.data ? document.documentElement.nextSibling.data : '';
        return signature && signature.includes('Debug: cached');
    }

    async _isGeneratedBefore() {
        let data_check = new FormData();
        data_check.append('action', 'rocket_check_beacon');
        data_check.append('rocket_beacon_nonce', this.config.nonce);
        data_check.append('url', this.config.url);
        data_check.append('is_mobile', this.config.is_mobile);

        const beacon_data_response = await fetch(this.config.ajax_url, {
            method: "POST",
            credentials: 'same-origin',
            body: data_check
        }).then(data => data.json());

        return beacon_data_response.data;
    }

    _isNotValidScreensize() {
        const screenWidth = window.innerWidth || document.documentElement.clientWidth;
        const screenHeight = window.innerHeight || document.documentElement.clientHeight;

        const isNotValidForMobile = this.config.is_mobile &&
            (screenWidth > this.config.width_threshold || screenHeight > this.config.height_threshold);
        const isNotValidForDesktop = !this.config.is_mobile &&
            (screenWidth < this.config.width_threshold || screenHeight < this.config.height_threshold);

        return isNotValidForMobile || isNotValidForDesktop;
    }

    static _isIntersecting(rect) {
        return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    _saveFinalResultIntoDB() {
        const lcpResults = this.lcpBeacon ? this.lcpBeacon.getResults() : null;

        const data = new FormData();
        data.append('action', 'rocket_beacon');
        data.append('rocket_beacon_nonce', this.config.nonce);
        data.append('url', this.config.url);
        data.append('is_mobile', this.config.is_mobile);
        data.append('status', this._getFinalStatus());
        data.append('lcp_images', JSON.stringify(lcpResults));

        fetch(this.config.ajax_url, {
            method: "POST",
            credentials: 'same-origin',
            body: data,
            headers: {
                'wpr-saas-no-intercept': true
            }
        })
            .then(response => response.json())
            .then(data => {
                this._logMessage(data);
            })
            .catch(error => {
                this._logMessage(error);
            })
            .finally(() => {
                this._finalize();
            });
    }

    _getFinalStatus() {
        if ('' !== this.errorCode) {
            return this.errorCode;
        }

        const scriptTime = (new Date() - this.scriptTimer) / 1000;
        if (10 <= scriptTime) {
            return 'timeout';
        }

        return 'success';
    }

    _handleInfiniteLoop() {
        this._saveFinalResultIntoDB();
    }

    _finalize() {
        const beaconscript = document.querySelector('[data-name="wpr-wpr-beacon"]');
        beaconscript.setAttribute('beacon-completed', 'true');
        clearTimeout(this.infiniteLoopId);
    }

    _logMessage(msg) {
        if (!this.config.debug) {
            return;
        }
        console.log(msg);
    }
}

export default RocketBeacon;
