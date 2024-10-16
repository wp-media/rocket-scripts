'use strict';

class BeaconUtils {
    static getScreenWidth() {
        return window.innerWidth || document.documentElement.clientWidth;
    }

    static getScreenHeight() {
        return window.innerHeight || document.documentElement.clientHeight;
    }

    static isNotValidScreensize( is_mobile, threshold ) {
        const screenWidth = this.getScreenWidth();
        const screenHeight = this.getScreenHeight();

        const isNotValidForMobile = is_mobile &&
          (screenWidth > threshold.width || screenHeight > threshold.height);
        const isNotValidForDesktop = !is_mobile &&
          (screenWidth < threshold.width || screenHeight < threshold.height);

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

    static isPageScrolled() {
        return window.pageYOffset > 0 || document.documentElement.scrollTop > 0;
    }

}

export default BeaconUtils;