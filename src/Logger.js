'use strict';

class Logger {
    constructor(enabled) {
        this.enabled = enabled;
    }

    logMessage(msg) {
        if (!this.enabled) {
            return;
        }
        console.log(msg);
    }
}

export default Logger;