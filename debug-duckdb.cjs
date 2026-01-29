const binary = require('@mapbox/node-pre-gyp');
const path = require('path');
const duckdbPackagePath = path.resolve(__dirname, 'node_modules/duckdb/package.json');
try {
    const binding_path = binary.find(duckdbPackagePath);
    console.log('Expected binding path:', binding_path);
} catch (e) {
    console.error('Error finding binding path:', e);
}
