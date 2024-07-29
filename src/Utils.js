'use strict';

class BeaconUtils {
    static isNotValidScreensize( is_mobile, threshold ) {
        const screenWidth = window.innerWidth || document.documentElement.clientWidth;
        const screenHeight = window.innerHeight || document.documentElement.clientHeight;

        const isNotValidForMobile = is_mobile &&
            (screenWidth > threshold.width || screenHeight > threshold.height);
        const isNotValidForDesktop = !is_mobile &&
            (screenWidth < threshold.width || screenHeight < threshold.width);

        return isNotValidForMobile || isNotValidForDesktop;
    }

    static isPageCached() {
        const signature = document.documentElement.nextSibling && document.documentElement.nextSibling.data ? document.documentElement.nextSibling.data : '';
        return signature && signature.includes('Debug: cached');
    }

    static isIntersecting(rect) {
        return (
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.left <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

}

export default BeaconUtils;