# GitHub Copilot Instructions for rocket-scripts

## Project Overview

**rocket-scripts** is the main JavaScript package for WP Rocket plugin's beacon functionality. It provides client-side performance optimization detection for:
- **LCP (Largest Contentful Paint)** detection
- **LRC (Lazy Render Content)** identification  
- **Font preloading** analysis
- **External domain preconnection** discovery

The bundle is built with esbuild and consumed by the WP Rocket WordPress plugin.

## Architecture & Code Patterns

### Module Structure
- **Entry Point**: `BeaconEntryPoint.js` - Initializes BeaconManager with configuration from `window.rocket_beacon_data`
- **Manager**: `BeaconManager.js` - Orchestrates all beacon modules
- **Feature Modules**: `BeaconLcp.js`, `BeaconLrc.js`, `BeaconPreloadFonts.js`, `BeaconPreconnectExternalDomain.js`
- **Utilities**: `Utils.js`, `Logger.js`

### Core Principles

1. **ES6 Modules**: All files use ES6 `import`/`export` syntax with explicit `.js` extensions
2. **Class-Based**: Each beacon is implemented as a class with constructor and methods
3. **Async/Await**: Prefer async/await over promise chains for asynchronous operations
4. **Defensive Programming**: Always check for null/undefined before accessing properties
5. **Performance-First**: Code runs on the client side and must be highly optimized

### Coding Standards

#### Style & Format
```javascript
// Use 'use strict' directive in class files
'use strict';

// Class structure
class BeaconFeature {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        // Initialize properties
    }

    async run() {
        try {
            // Main logic
        } catch (err) {
            this.errorCode = 'script_error';
            this.logger.logMessage('Script Error: ' + err);
        }
    }

    getResults() {
        return this.results;
    }
}

export default BeaconFeature;
```

#### Naming Conventions
- **Classes**: PascalCase (e.g., `BeaconManager`, `BeaconLcp`)
- **Methods**: camelCase (e.g., `run()`, `getResults()`)
- **Private Methods**: Prefix with underscore (e.g., `_isValidPreconditions()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `FONT_FILE_REGEX`)
- **Variables**: camelCase (e.g., `performanceImages`, `aboveTheFoldElements`)

#### DOM & Browser APIs
- Use `window.getComputedStyle()` for element styles
- Use `element.getBoundingClientRect()` for positioning
- Use `document.querySelector()` / `querySelectorAll()` for DOM queries
- Use `window.performance` API for resource timing
- Always check if window/document objects exist before use

#### Utility Usage
```javascript
// Import shared utilities from Utils.js
import BeaconUtils from "./Utils.js";

// Use utility methods for common operations
if (BeaconUtils.isElementVisible(element)) {
    // Process visible element
}

if (BeaconUtils.isPageScrolled()) {
    // Bail out if page is scrolled
}
```

#### Logger Usage
```javascript
// Initialize logger with debug flag from config
this.logger = new Logger(this.config.debug);

// Log messages (only outputs when debug is enabled)
this.logger.logMessage('Processing element');
this.logger.logMessage('Element data:', elementData);

// Log colored messages for visual distinction
this.logger.logColoredMessage('Element pushed', 'green');
this.logger.logColoredMessage('Element skipped', 'orange');
```

#### Element Filtering Patterns
```javascript
// Standard pattern for filtering elements
const validElements = Array.from(elements)
    .filter(element => {
        if (!element) {
            return false;
        }
        // Apply visibility checks
        if (!BeaconUtils.isElementVisible(element)) {
            return false;
        }
        // Apply custom criteria
        return true;
    });
```

#### Rectangle/Viewport Calculations
```javascript
// Get element position relative to viewport
const rect = element.getBoundingClientRect();

// Check if element is in viewport
if (BeaconUtils.isIntersecting(rect)) {
    // Process element
}

// Calculate visible area
const visibleWidth = Math.min(
    rect.width, 
    (window.innerWidth || document.documentElement.clientWidth) - rect.left
);
const visibleHeight = Math.min(
    rect.height,
    (window.innerHeight || document.documentElement.clientHeight) - rect.top
);
const area = visibleWidth * visibleHeight;
```

### Testing Standards

#### Test Structure
- **Framework**: Mocha with Sinon for mocking
- **Location**: All tests in `/test` directory with `.test.js` suffix
- **Pattern**: Mirror source structure (e.g., `BeaconLcp.test.js` tests `BeaconLcp.js`)

#### Test Pattern
```javascript
import assert from 'assert';
import sinon from 'sinon';
import BeaconClass from '../src/BeaconClass.js';

describe('BeaconClass', function() {
    let instance;
    let config;

    beforeEach(function() {
        config = { /* test config */ };
        instance = new BeaconClass(config);
        
        // Mock global objects
        global.window = { /* mock window */ };
        global.document = { /* mock document */ };
    });

    afterEach(function() {
        // Restore stubs
    });

    describe('#methodName()', function() {
        it('should do expected behavior', function() {
            // Test implementation
            assert.strictEqual(result, expected);
        });
    });
});
```

#### Mocking Patterns
```javascript
// Stub fetch API
const fetchStub = sinon.stub(global, 'fetch').resolves({
    json: () => Promise.resolve({ data: 'test' })
});

// Restore after test
fetchStub.restore();

// Spy on methods
const spy = sinon.spy(instance, '_privateMethod');
sinon.assert.calledOnce(spy);

// Stub methods with return values
sinon.stub(instance, 'method').resolves(true);
```

### AJAX/Fetch Patterns

```javascript
// Standard FormData POST pattern
const data = new FormData();
data.append('action', 'rocket_beacon');
data.append('rocket_beacon_nonce', this.config.nonce);
data.append('url', this.config.url);
data.append('is_mobile', this.config.is_mobile);
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
```

### Configuration Pattern

All beacons receive configuration from `window.rocket_beacon_data`:

```javascript
{
    nonce: string,           // Security nonce
    url: string,             // Current page URL
    ajax_url: string,        // WordPress AJAX endpoint
    is_mobile: boolean,      // Mobile detection flag
    delay: number,           // Initialization delay in ms
    debug: boolean,          // Debug logging flag
    status: {
        atf: boolean,        // Above the fold detection
        lrc: boolean,        // Lazy render content
        preload_fonts: boolean,
        preconnect_external_domain: boolean
    },
    width_threshold: number,
    height_threshold: number,
    elements: string,        // CSS selector
    // Additional feature-specific config
}
```

### Error Handling

```javascript
// Set error codes for tracking
this.errorCode = 'script_error';
this.errorCode = 'timeout';

// Use try-catch in async methods
async run() {
    try {
        // Feature logic
    } catch (err) {
        this.errorCode = 'script_error';
        this.logger.logMessage('Script Error: ' + err);
    }
}

// Handle fetch errors
fetch(url)
    .then(response => {
        if (!response.ok) {
            this.logger.logMessage(`Failed: ${response.status}`);
            return null;
        }
        return response.json();
    })
    .catch(error => {
        this.logger.logMessage('Network error:', error);
        return null;
    });
```

### Build & Distribution

- **Build Tool**: esbuild
- **Output**: `dist/wpr-beacon.js` (unminified) and `dist/wpr-beacon.min.js` (minified)
- **Commands**:
  - `npm run build:unmin` - Build unminified
  - `npm run build:min` - Build minified with sourcemap
  - `npm run build` - Build both versions
- **Source Maps**: Generated for minified version only

### Performance Considerations

1. **Early Bailout**: Check preconditions before heavy processing
```javascript
if (BeaconUtils.isPageScrolled()) {
    this.logger.logMessage('Bailing out because the page has been scrolled');
    this._finalize();
    return;
}
```

2. **Timeout Protection**: All beacons have 10-second timeout
```javascript
this.infiniteLoopId = setTimeout(() => {
    this._handleInfiniteLoop();
}, 10000);
```

3. **Minimize DOM Queries**: Cache selectors and results
```javascript
const elements = document.querySelectorAll(this.config.elements);
const elementsArray = Array.from(elements); // Convert once
```

4. **Await Font Loading**: Wait for fonts before analysis
```javascript
await document.fonts.ready;
```

### Common Gotchas

1. **Picture Elements**: Check for `<picture>` parent when analyzing `<img>`
```javascript
if ('img' === element.nodeName.toLowerCase() && 
    'picture' === element.parentElement.nodeName.toLowerCase()) {
    return null; // Handle at picture level instead
}
```

2. **Computed Styles**: Always handle null/undefined styles
```javascript
const style = window.getComputedStyle(element);
if (!style) {
    return false;
}
```

3. **URL Construction**: Use try-catch for URL parsing
```javascript
try {
    const url = new URL(element.src, window.location.href);
} catch (e) {
    this.logger.logMessage('Invalid URL:', e);
    return null;
}
```

4. **CORS Stylesheets**: Cannot access `cssRules` from cross-origin stylesheets
```javascript
try {
    const rules = Array.from(sheet.cssRules || []);
} catch (e) {
    if (e.name === 'SecurityError') {
        // Fetch stylesheet content directly
    }
}
```

## Documentation Requirements

- Add JSDoc comments for public methods
- Document complex algorithms with inline comments
- Explain "why" not "what" in comments
- Update README.md for API changes

## Version Control

- Branch naming: `feature/`, `enhancement/`, `fix/`, `branch-`
- Commits: Clear, descriptive messages
- PRs: Target `develop` for features, `trunk` for hotfixes

## Testing Before Release

1. Run `npm test` - All tests must pass
2. Run `npm run build` - Ensure clean build
3. Test in WP Rocket context using branch dependency method (see README)
4. Verify no console errors in browser

## Integration with WP Rocket

- Scripts are consumed via npm package `wp-rocket-scripts`
- Built files are processed by WP Rocket gulp tasks
- Configuration comes from PHP backend via `window.rocket_beacon_data`
- Results are sent back to WordPress via AJAX for caching

## When Adding New Features

1. Create new beacon class in `src/`
2. Add corresponding test file in `test/`
3. Register in `BeaconManager.js`
4. Update `window.rocket_beacon_data` config structure in documentation
5. Add build output verification
6. Update README with feature description

## Debugging Tips

- Set `debug: true` in `rocket_beacon_data` to enable console logging
- Use `logger.logColoredMessage()` for visual distinction in logs
- Check `data-name="wpr-wpr-beacon"` element for `beacon-completed` attribute
- Monitor Network tab for AJAX requests to `rocket_beacon` action
- Use Performance API to verify resource detection

---

**Remember**: This code runs on every page load for WP Rocket users. Optimize for performance, be defensive with checks, and always consider the user experience impact.
