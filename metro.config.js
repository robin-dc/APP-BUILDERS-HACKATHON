const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// On-device models in models/ are bundled into the app as assets.
config.resolver.assetExts.push('gguf');

module.exports = withNativeWind(config, { input: './global.css' });
