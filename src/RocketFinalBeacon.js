import RocketBeacon from "./RocketBeacon.js";

( rocket_beacon_data => {
    if ( !rocket_beacon_data ) {
        return;
    }

    const instance = new RocketBeacon( rocket_beacon_data );

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