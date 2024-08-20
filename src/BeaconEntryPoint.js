import BeaconManager from "./BeaconManager.js";

( rocket_beacon_data => {
    if ( !rocket_beacon_data ) {
        return;
    }

    const instance = new BeaconManager( rocket_beacon_data );

    if (document.readyState !== 'loading') {
        setTimeout(() => {
            instance.init();
        }, rocket_beacon_data.delay);
        return;
    }

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
            instance.init();
        }, rocket_beacon_data.delay);
    });
} )( window.rocket_beacon_data );

module.exports = BeaconManager;