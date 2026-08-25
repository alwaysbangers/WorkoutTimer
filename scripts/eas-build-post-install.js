// Version: September 2025
// Purpose: Apply critical Android build patches for Expo SDK 52 compatibility (Kotlin 1.9.25, Gradle sync, MetaSharing + Autolinking injection)

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { execSync } = require('child_process');
const autolinkDir = path.join(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'java',
  'com',
  'navisavi'
);

// ------------------------------
// PATCH: MainApplication.kt
// ------------------------------
function patchMainApplicationKt(mainAppPath) {
  console.log(`[PATCH] 🔍 Reading ${mainAppPath}`);
  let contents = fs.readFileSync(mainAppPath, 'utf8');

  if (!contents.includes('import expo.modules.autolinking.PackageList')) {
    contents = contents.replace(
      /^package\s+[\w.]+\s*?\n/,
      (m) => `${m}import expo.modules.autolinking.PackageList\n`
    );
  }

  if (!contents.includes('MetaSharingPackage')) {
    contents = contents.replace(
      /^package\s+[\w.]+\s*?\n/,
      (m) => `${m}import com.projectName.MetaSharingPackage\n`
    );
  }

  if (!contents.includes('packages.add(MetaSharingPackage())')) {
    contents = contents.replace(
      /val packages = PackageList\(this\)(\.packages)?(\.toMutableList\(\))?/,
      (match) => {
        let line = match;
        if (!line.includes('.packages')) line += '.packages';
        if (!line.includes('toMutableList')) line += '.toMutableList()';
        return `${line}\n        packages.add(MetaSharingPackage())`;
      }
    );
  }

  fs.writeFileSync(mainAppPath, contents, 'utf8');
  console.log('[✅] Patched MainApplication.kt');
  console.log('[📄] Current MainApplication.kt contents:\n', contents);
}

// ------------------------------
// PATCH: app/build.gradle
// ------------------------------
function patchAppBuildGradle(appGradlePath) {
  let contents = fs.readFileSync(appGradlePath, 'utf8');
  const line = `    implementation project(":expo-modules-core")`;

  if (!contents.includes(line)) {
    contents = contents.replace(
      /dependencies\s*{([\s\S]*?)}/,
      (match, inner) => `dependencies {\n${line}\n${inner}}`
    );
    fs.writeFileSync(appGradlePath, contents, 'utf8');
    console.log('[✅] Patched app/build.gradle');
  } else {
    console.log('[ℹ️] app/build.gradle already includes expo-modules-core');
  }

  console.log('[📄] Current app/build.gradle contents:\n', contents);
}

// ------------------------------
// PATCH: settings.gradle
// ------------------------------
function patchSettingsGradle(settingsGradlePath) {
  let contents = fs.readFileSync(settingsGradlePath, 'utf8');

  const includeLine = `include(":expo-modules-core")`;
  const projectLine = `project(":expo-modules-core").projectDir = new File(rootProject.projectDir, "../node_modules/expo-modules-core/android")`;

  let updated = false;
  if (!contents.includes(includeLine)) { contents += `\n${includeLine}`; updated = true; }
  if (!contents.includes(projectLine)) { contents += `\n${projectLine}`; updated = true; }

  if (updated) {
    fs.writeFileSync(settingsGradlePath, contents, 'utf8');
    console.log('[✅] Patched settings.gradle');
  } else {
    console.log('[ℹ️] settings.gradle already patched');
  }
  console.log('[📄] Current settings.gradle contents:\n', contents);
}

// ------------------------------
// PATCH: root build.gradle (add Expo repo)
// ------------------------------
function patchRootBuildGradle(rootGradlePath) {
  let contents = fs.readFileSync(rootGradlePath, 'utf8');

  const expoRepoSnippet = `maven {\n      url 'https://artifactregistry.dev.expo.dev/android'\n    }`;

  if (!contents.includes('artifactregistry.dev.expo.dev')) {
    contents = contents.replace(
      /allprojects\s*{[\s\S]*?repositories\s*{([\s\S]*?)}/,
      (match) => match.replace(
        /repositories\s*{([\s\S]*?)}/,
        (repoMatch, repoInner) => `repositories {\n    ${expoRepoSnippet}\n    ${repoInner.trim()}\n  }`
      )
    );

    fs.writeFileSync(rootGradlePath, contents, 'utf8');
    console.log('[✅] Patched root build.gradle with Expo repo');
  } else {
    console.log('[ℹ️] root build.gradle already includes Expo repo');
  }

  console.log('[📄] Current root build.gradle contents:\n', contents);
}

function stripExtKotlinVersionInRootBuildGradle(rootGradlePath) {
  if (!fs.existsSync(rootGradlePath)) return;
  let contents = fs.readFileSync(rootGradlePath, 'utf8');

  if (/ext\.kotlin_version\s*=/.test(contents)) {
    contents = contents.replace(/^\s*ext\.kotlin_version\s*=\s*['"].*?['"]\s*$/gm, '');
    fs.writeFileSync(rootGradlePath, contents, 'utf8');
    console.log('[🧼] Removed legacy ext.kotlin_version from root build.gradle');
  } else {
    console.log('[✅] No legacy ext.kotlin_version found in root build.gradle');
  }
}

// ------------------------------
// PATCH: gradle.properties
// ------------------------------
function patchGradleProperties(gradlePropertiesPath) {
  if (!fs.existsSync(gradlePropertiesPath)) {
    console.warn('[⚠️] gradle.properties not found — skipping patch');
    return;
  }

  let contents = fs.readFileSync(gradlePropertiesPath, 'utf8');

  const kotlinLine = 'kotlin.version=1.9.25';
  const suppressLine = 'android.suppressUnsupportedCompileSdk=35';

  if (/^\s*kotlin\.version\s*=/m.test(contents)) {
    contents = contents.replace(/^\s*kotlin\.version\s*=.*$/m, kotlinLine);
    console.log('[🔁] Updated kotlin.version in gradle.properties');
  } else {
    contents += (contents.endsWith('\n') ? '' : '\n') + kotlinLine + '\n';
    console.log('[➕] Inserted kotlin.version in gradle.properties');
  }

  if (/^\s*android\.suppressUnsupportedCompileSdk\s*=/m.test(contents)) {
    contents = contents.replace(/^\s*android\.suppressUnsupportedCompileSdk\s*=.*$/m, suppressLine);
    console.log('[🔁] Updated android.suppressUnsupportedCompileSdk in gradle.properties');
  } else {
    contents += (contents.endsWith('\n') ? '' : '\n') + suppressLine + '\n';
    console.log('[➕] Inserted android.suppressUnsupportedCompileSdk in gradle.properties');
  }

  fs.writeFileSync(gradlePropertiesPath, contents, 'utf8');
  console.log('[📄] Current gradle.properties contents:\n', contents);
}

// ------------------------------
// PATCH: libs.versions.toml
// ------------------------------
function patchKotlinInToml(tomlPath) {
  if (!fs.existsSync(tomlPath)) {
    console.warn('[⚠️] libs.versions.toml not found — skipping Kotlin patch');
    return;
  }
  let contents = fs.readFileSync(tomlPath, 'utf8');

  if (!/^\s*\[versions\]\s*$/m.test(contents)) {
    contents = contents.trimEnd() + `\n\n[versions]\n`;
    console.log('[➕] Inserted [versions] table in libs.versions.toml');
  }

  const versionsSectionRegex = /(\[versions\][\s\S]*?)(\n\[[^\]]+\]|\s*$)/m;
  const match = contents.match(versionsSectionRegex);
  if (match) {
    let section = match[1];
    if (/^\s*kotlin\s*=/m.test(section)) {
      section = section.replace(/^\s*kotlin\s*=\s*".*?"\s*$/m, 'kotlin = "1.9.25"');
      console.log('[🔁] Updated Kotlin in [versions] (libs.versions.toml)');
    } else {
      section = section.trimEnd() + `\nkotlin = "1.9.25"\n`;
      console.log('[➕] Inserted Kotlin in [versions] (libs.versions.toml)');
    }
    contents = contents.replace(versionsSectionRegex, section + match[2]);
  }

  fs.writeFileSync(tomlPath, contents, 'utf8');
  console.log('[📄] Current libs.versions.toml contents:\n', contents);
}

// ------------------------------
// PATCH: Force kotlin-gradle-plugin to 1.9.25
// ------------------------------
function forceKotlinGradlePluginVersion(rootGradlePath) {
  if (!fs.existsSync(rootGradlePath)) {
    console.warn(`[⚠️] ${rootGradlePath} not found — cannot pin Kotlin Gradle Plugin version`);
    return;
  }

  console.log(`[PATCH] 🔧 Forcing kotlin-gradle-plugin:1.9.25 in ${rootGradlePath}`);
  let contents = fs.readFileSync(rootGradlePath, 'utf8');

  const bareRegex = /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin['"]\s*\)/;
  const withVersionRegex = /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+['"]\s*\)/;

  const before = contents;

  if (bareRegex.test(contents)) {
    contents = contents.replace(
      bareRegex,
      'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
    );
    console.log('[✅] Replaced bare kotlin-gradle-plugin with version 1.9.25');
  } else if (withVersionRegex.test(contents)) {
    contents = contents.replace(
      withVersionRegex,
      'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")'
    );
    console.log('[✅] Overrode existing kotlin-gradle-plugin version to 1.9.25');
  } else {
    console.warn('[⚠️] kotlin-gradle-plugin classpath line not found — nothing changed.');
  }

  if (contents !== before) {
    fs.writeFileSync(rootGradlePath, contents, 'utf8');
  }

  console.log('[📄] Current root build.gradle (kotlin classpath patched):\n', contents);
}

// ------------------------------
// PATCH: Inject missing Kotlin stubs for autolinking (INLINE)
// ------------------------------
    function injectAutoLinkingFilesInline() {
  const targetDir = autolinkDir;
  fs.mkdirSync(targetDir, { recursive: true });

  const files = [
            {
            name: 'PackageList.kt',
            contents: `package com.projectName

      import android.app.Application
      import com.facebook.react.ReactPackage

      class PackageList(private val application: Application) {
        val packages: List<ReactPackage>
          get() = listOf(
            // Add any packages here if needed.
          )
      }`
          },
          {
            name: 'ApplicationLifecycleDispatcher.kt',
            contents: `package com.projectName

      import android.app.Application
      import android.content.ComponentCallbacks
      import android.content.res.Configuration

      object ApplicationLifecycleDispatcher : ComponentCallbacks {
        private var application: Application? = null

        fun onApplicationCreate(app: Application?) {
          if (app == null || this.application != null) return
          this.application = app
          app.registerComponentCallbacks(this)
        }

        override fun onConfigurationChanged(newConfig: Configuration) {}
        override fun onLowMemory() {}
      }`
          },
          {
            name: 'MainActivity.kt',
            contents: `package com.projectName

      import com.facebook.react.ReactActivity
      import com.facebook.react.ReactActivityDelegate

      class MainActivity : ReactActivity() {
        override fun getMainComponentName(): String = "main"

        override fun createReactActivityDelegate(): ReactActivityDelegate {
          return ReactActivityDelegateWrapper(this, mainComponentName)
        }
      }`
          },
        {
          name: 'MainApplication.kt',
          contents: `package com.projectName

        import android.app.Application
        import android.content.Context
        import com.facebook.react.ReactApplication
        import com.facebook.react.ReactNativeHost
        import com.facebook.react.ReactPackage
        import com.facebook.soloader.SoLoader
        import com.projectName.ApplicationLifecycleDispatcher
        import com.projectName.PackageList

        class MainApplication : Application(), ReactApplication {

          override val reactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {
            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override fun getPackages(): List<ReactPackage> {
              return PackageList(this@MainApplication).packages
            }

            override fun getJSMainModuleName(): String = "index"
          }

          override fun onCreate() {
            super.onCreate()
            SoLoader.init(this, false)
            ApplicationLifecycleDispatcher.onApplicationCreate(this)
          }

          override fun attachBaseContext(base: Context) {
            super.attachBaseContext(base)
            ApplicationLifecycleDispatcher.onApplicationCreate(this)
          }
        }`
        },
          {
          name: 'ReactActivityDelegateWrapper.kt',
          contents: `package com.projectName

        import android.os.Bundle
        import com.facebook.react.ReactActivity
        import com.facebook.react.ReactActivityDelegate
        import com.facebook.react.ReactRootView

        class ReactActivityDelegateWrapper(
          private val activity: ReactActivity,
          mainComponentName: String?
        ) : ReactActivityDelegate(activity, mainComponentName) {

          override fun createRootView(): ReactRootView {
            return ReactRootView(activity)
          }

          override fun onCreate(savedInstanceState: Bundle?) {
            super.onCreate(savedInstanceState)
          }
        }`
        },
          {
            name: 'MainActivityDelegate.kt',
            contents: `package com.projectName

      import android.app.Activity
      import android.os.Bundle
      import com.facebook.react.ReactActivityDelegate
      import com.facebook.react.ReactRootView

      class MainActivityDelegate(
        private val activity: Activity
      ) : ReactActivityDelegate(activity, null) {

        override fun createRootView(): ReactRootView {
          return ReactRootView(activity)
        }

        override fun onCreate(savedInstanceState: Bundle?) {
          super.onCreate(savedInstanceState)
        }
      }`
          }
        ];

        for (const file of files) {
          const filePath = path.join(targetDir, file.name);
          fs.writeFileSync(filePath, file.contents, 'utf8');
          console.log(`[✅] Injected ${file.name} → ${filePath}`);
        }

        const injected = fs.readdirSync(targetDir).filter(f => f.endsWith('.kt'));
        console.log('[📦] Kotlin stubs injected to com.projectName:');
        injected.forEach(f => console.log(` - ${f}`));
      }

// ------------------------------
// Dry Run Gradle Check
// ------------------------------
function runGradleCheck() {
  console.log('[🧪] Running Gradle dependency check (dry run)');
  try {
    execSync('./gradlew dependencies', { cwd: 'android', stdio: 'inherit' });
  } catch (err) {
    console.error('[❌] Gradle dry run failed. This may indicate unresolved dependencies.');
    console.error(err.message);
  }
}

// ------------------------------
// PATCH: Inject missing Meta-sharing stubs for autolinking (INLINE)
// ------------------------------
    function injectMetaSharingPackage() {
      console.log('[INJECT] Copying real MetaSharing files to generated android folder');

      const sourceDir = path.join(
        process.cwd(),
        'src',
        'plugins',
        'native-code',
        'android',
        'meta-sharing'
      );

      const targetDir = path.join(
        process.cwd(),
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'navisavi'
      );

      fs.mkdirSync(targetDir, { recursive: true });

      const filesToCopy = [
        'MetaSharingFileProvider.kt',
        'MetaSharingModule.kt',
        'MetaSharingPackage.kt'
      ];

      for (const fileName of filesToCopy) {
        const src = path.join(sourceDir, fileName);
        const dest = path.join(targetDir, fileName);

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[✅] Copied ${fileName} to ${dest}`);
        } else {
          console.warn(`[⚠️] File not found: ${src}`);
        }
      }
    }

// ------------------------------
// RUN ALL PATCHES
// ------------------------------
function run() {
  console.log('='.repeat(60));
  console.log('\n[eas-build-post-install] 🚀 Starting post-install patch');
  const root = process.cwd();

  try { patchGradleProperties(path.join(root, 'android', 'gradle.properties')); } catch (e) { console.error(e); }
  try { patchKotlinInToml(path.join(root, 'android', 'gradle', 'libs.versions.toml')); } catch (e) { console.error(e); }
  try { stripExtKotlinVersionInRootBuildGradle(path.join(root, 'android', 'build.gradle')); } catch (e) { console.error(e); }

  const ktFiles = glob.sync(path.join(root, 'android', 'app', 'src', 'main', 'java', '**', 'MainApplication.kt'));
  if (ktFiles.length && fs.existsSync(ktFiles[0])) {
    try { patchMainApplicationKt(ktFiles[0]); } catch (e) { console.error(e); }
  } else {
    console.warn('[⚠️] MainApplication.kt not found');
  }

  try { patchAppBuildGradle(path.join(root, 'android', 'app', 'build.gradle')); } catch (e) { console.error(e); }
  try { patchSettingsGradle(path.join(root, 'android', 'settings.gradle')); } catch (e) { console.error(e); }
  try { patchRootBuildGradle(path.join(root, 'android', 'build.gradle')); } catch (e) { console.error(e); }
  try { forceKotlinGradlePluginVersion(path.join(root, 'android', 'build.gradle')); } catch (e) { console.error(e); }

  try { injectAutoLinkingFilesInline(); } catch (e) { console.error(e); }
  try { injectMetaSharingPackage(); } catch (e) { console.error(e); }
  try { runGradleCheck(); } catch (e) { console.error(e); }

  console.log('[✅] Post-install complete\n');
  console.log('='.repeat(60));
}

run();
