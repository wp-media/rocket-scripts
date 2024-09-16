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

    logColoredMessage( msg, color = 'green' ) {
        if (!this.enabled) {
            return;
        }
        console.log(`%c${msg}`, `color: ${color};`);
    }
}

export default Logger;