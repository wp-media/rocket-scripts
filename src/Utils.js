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

    /**
     * Checks if an element is visible in the viewport.
     * 
     * This method checks if the provided element is visible in the viewport by
     * considering its display, visibility, opacity, width, and height properties.
     * It also excludes elements with transparent text properties.
     * It returns true if the element is visible, and false otherwise.
     * 
     * @param {Element} element - The element to check for visibility.
     * @returns {boolean} True if the element is visible, false otherwise.
     */
    static isElementVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        // Defensive check for style
        if (!style) {
            return false;
        }

        // Exclude elements with transparent text properties
        if (this.hasTransparentText(element)) {
            return false;
        }

        return !(
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            rect.width === 0 ||
            rect.height === 0
        );
    }

    /**
     * Checks if an element has transparent text properties.
     *
     * This method checks for specific CSS properties that make text invisible,
     * such as `color: transparent`, `color: rgba(..., 0)`, `color: hsla(..., 0)`,
     * `color: #...00` (8-digit hex with alpha = 0), and `filter: opacity(0)`.
     *
     * @param {Element} element - The element to check.
     * @returns {boolean} True if the element has transparent text properties, false otherwise.
     */
    static hasTransparentText(element) {
        const style = window.getComputedStyle(element);

        // Defensive check for style properties
        if (!style) {
            return false;
        }
        
        const color = style.color || '';
        const filter = style.filter || '';

        // Check for `color: transparent`
        if (color === 'transparent') {
            return true;
        }

        // Check for `color: rgba(..., 0)`
        const rgbaMatch = color.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\)/);
        if (rgbaMatch) {
            return true;
        }

        // Check for `color: hsla(..., 0)`
        const hslaMatch = color.match(/hsla\(\d+,\s*\d+%,\s*\d+%,\s*0\)/);
        if (hslaMatch) {
            return true;
        }

        // Check for `color: #...00` (8-digit hex with alpha = 0)
        const hexMatch = color.match(/#[0-9a-fA-F]{6}00/);
        if (hexMatch) {
            return true;
        }

        // Check for `filter: opacity(0)`
        if (filter.includes('opacity(0)')) {
            return true;
        }

        return false;
    }

}

export default BeaconUtils;