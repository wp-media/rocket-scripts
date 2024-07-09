import { LcpBeacon } from './LcpBeacon';

if ( !window.rocket_lcp_data ) {
    return;
}

const instance = new LcpBeacon( window.rocket_lcp_data );

if (document.readyState !== 'loading') {
    setTimeout(() => {
        instance.init();
    }, window.rocket_lcp_data.delay);
    return;
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        instance.init();
    }, window.rocket_lcp_data.delay);
});