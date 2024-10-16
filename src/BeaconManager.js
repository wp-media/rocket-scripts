'use strict';

import BeaconLcp from "./BeaconLcp.js";
import BeaconLrc from "./BeaconLrc.js";
import BeaconUtils from "./Utils.js";
import Logger from "./Logger.js";

class BeaconManager {
    constructor(config) {
        this.config = config;
        this.lcpBeacon = null;
        this.lrcBeacon = null;
        this.infiniteLoopId = null;
        this.errorCode = '';
        this.logger = new Logger(this.config.debug);
    }

    async init() {
        this.scriptTimer = new Date();
        if (!await this._isValidPreconditions()) {
            this._finalize();
            return;
        }

        if (BeaconUtils.isPageScrolled()) {
            this.logger.logMessage('Bailing out because the page has been scrolled');
            this._finalize();
            return;
        }

        this.infiniteLoopId = setTimeout(() => {
            this._handleInfiniteLoop();
        }, 10000);

        const isGeneratedBefore = await this._getGeneratedBefore();

        // OCI / LCP / ATF
        const shouldGenerateLcp = (
            this.config.status.atf && (isGeneratedBefore === false || isGeneratedBefore.lcp === false)
        );
        const shouldGeneratelrc = (
            this.config.status.lrc && (isGeneratedBefore === false || isGeneratedBefore.lrc === false)
        );
        if (shouldGenerateLcp) {
            this.lcpBeacon = new BeaconLcp(this.config, this.logger);
            await this.lcpBeacon.run();
        } else {
            this.logger.logMessage('Not running BeaconLcp because data is already available or feature is disabled');
        }

        if (shouldGeneratelrc) {
            this.lrcBeacon = new BeaconLrc(this.config, this.logger);
            await this.lrcBeacon.run();
        } else {
            this.logger.logMessage('Not running BeaconLrc because data is already available or feature is disabled');
        }

        if (shouldGenerateLcp || shouldGeneratelrc) {
            this._saveFinalResultIntoDB();
        } else {
            this.logger.logMessage("Not saving results into DB as no beacon features ran.");
            this._finalize();
        }
    }

    async _isValidPreconditions() {
        const threshold = {
            width: this.config.width_threshold,
            height: this.config.height_threshold
        };
        if (BeaconUtils.isNotValidScreensize(this.config.is_mobile, threshold)) {
            this.logger.logMessage('Bailing out because screen size is not acceptable');
            return false;
        }

        return true;
    }

    async _getGeneratedBefore() {

        if (!BeaconUtils.isPageCached()) {
            return false;
        }     

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

    _saveFinalResultIntoDB() {
        const results = {
            lcp: this.lcpBeacon ? this.lcpBeacon.getResults() : null,
            lrc: this.lrcBeacon ? this.lrcBeacon.getResults() : null
        };

        const data = new FormData();
        data.append('action', 'rocket_beacon');
        data.append('rocket_beacon_nonce', this.config.nonce);
        data.append('url', this.config.url);
        data.append('is_mobile', this.config.is_mobile);
        data.append('status', this._getFinalStatus());
        data.append('results', JSON.stringify(results));

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
                this.logger.logMessage(data.data.lcp);
            })
            .catch(error => {
                this.logger.logMessage(error);
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

}

export default BeaconManager;
