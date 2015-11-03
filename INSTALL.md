# Horizon Panel

### Installation

Add `flot.florizon` dependencies to `/public/app/components/require.config.js`

```javascript
require.config({
  [...],
  paths: {
    [...],
    'jquery.flot.fillbelow':   'vendor/flot/jquery.flot.fillbelow',
    // LINE TO ADD
    'jquery.flot.florizon':    'app/panels/horizon/florizon',
    // LINE TO ADD
    modernizr:                 'vendor/modernizr-2.6.1',
    [...],
  },
  shim: {
    [...],
    'jquery.flot.fillbelow':['jquery', 'jquery.flot'],
    // LINE TO ADD
    'jquery.flot.florizon' :['jquery', 'jquery.flot'],
    // LINE TO ADD
    'angular-dragdrop':     ['jquery', 'angular'],
    [...],
  },
});
```

Add panel in `/public/app/components/settings.js`

```javascript
[...],
function (_) {
  [...],
  return function Settings (options) {
    var defaults = {
      [...],
      panels                        : {
        'graph':      { path: 'app/panels/graph',      name: 'Graph' },
        // LINE TO ADD
        'horizon':    { path: 'app/panels/horizon',    name: 'Horizon' },
        // LINE TO ADD
        'singlestat': { path: 'app/panels/singlestat', name: 'Single stat' },
        [...],
      },
      [...],
    };
    [...]
    return settings;
  };
});
```
