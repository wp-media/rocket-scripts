'use strict';

import BeaconLcp from "./BeaconLcp.js";
import BeaconUtils from "./Utils.js";
import Logger from "./Logger.js";

class BeaconManager {
    constructor(config) {
        this.config = config;
        this.lcpBeacon = null;
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

        this.infiniteLoopId = setTimeout(() => {
            this._handleInfiniteLoop();
        }, 10000);

        const isGeneratedBefore = await this._getGeneratedBefore();
        let shouldSaveResultsIntoDB = false;

        // OCI / LCP / ATF
        const shouldGenerateLcp = (
            this.config.status.atf && (isGeneratedBefore === false)
        );
        if (shouldGenerateLcp) {
            this.lcpBeacon = new BeaconLcp(this.config, this.logger);
            await this.lcpBeacon.run();
            shouldSaveResultsIntoDB = true;
        } else {
            this.logger.logMessage('Not running BeaconLcp because data is already available');
        }

        if (shouldSaveResultsIntoDB) {
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

        return beacon_data_response.success;
        
    }

    _saveFinalResultIntoDB() {
        const results = {
            lcp: this.lcpBeacon ? this.lcpBeacon.getResults() : null
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
                this.logger.logMessage(data);
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
