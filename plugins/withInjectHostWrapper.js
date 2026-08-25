const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withInjectHostWrapper(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const srcDir = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'projectName'
      );

      if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
      }

      const filePath = path.join(srcDir, 'ReactNativeHostWrapper.kt');

      const contents = `package com.projectName

import android.app.Application
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage

class ReactNativeHostWrapper(application: Application) : ReactNativeHost(application) {

  override fun getUseDeveloperSupport(): Boolean {
    return BuildConfig.DEBUG
  }

  override fun getJSMainModuleName(): String {
    return "index"
  }

  override fun getPackages(): List<ReactPackage> {
    return PackageList(application).packages
  }
}
`;

      fs.writeFileSync(filePath, contents, 'utf8');
      console.log('[🔌 withInjectHostWrapper] ✅ Injected ReactNativeHostWrapper.kt → ' + filePath);

      return config;
    },
  ]);
}

module.exports = withInjectHostWrapper;
