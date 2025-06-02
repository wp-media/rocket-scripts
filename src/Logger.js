'use strict';

class Logger {
    constructor(enabled) {
        this.enabled = enabled;
    }

    logMessage(label, msg = '') {
        if (!this.enabled) {
          return;
        }
  
        if (msg !== '') {
          console.log(label, msg);
          return;
        }
  
        console.log(label);
      }

    logColoredMessage( msg, color = 'green' ) {
        if (!this.enabled) {
            return;
        }
        console.log(`%c${msg}`, `color: ${color};`);
    }
}

export default Logger;