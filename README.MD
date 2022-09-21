# iOS react-native header path failure with use_frameworks! and pnpm

When using pnpm as a package manager along with `use_frameworks!` iOS builds fail because the header files for
the `React-bridging`
pod don't get copied to the correct directory.

They should end up at `iOS/Pods/Headers/Private/React-bridging/react/bridging`
but they actually end up
at `ios/build/Build/Products/Debug-iphonesimulator/React-bridging/.pnpm/react-native@0.69.5_xbangyd2oalr524ah376m5q3oi_tf4i3rco7go2qrnsv66v2274bm/node_modules/react-native/ReactCommon/react/bridging`
.

I'm not sure if this is specific to EAS build but that's what I use so I made the repro using it.

## Motivation

`use_framewoks!` is a requirement for `react-native-firebase` v15 and up since the underlying
google libraries have a hard requirement for it. I need to use v15+ in my app to support firebase cloud functions v2.

`pnpm` is used because I've been bitten by "ghost dependencies" too many times in a monorepo. Hoisting all packages to
root level and allowing any package to be resolved if it just happens to be required transitively by any project in
the repo is a recipe for pain. `pnpm` fixes that by disallowing resolution of undeclared dependencies, 
requiring correct peer deps, and not hoisting anything. See below for tweaks needed to work around metro deficiencies.

## To reproduce

1. npm install -g pnpm
2. npm install -g eas-cli
2. pnpm install
3. pnpm build-local

Observe the build failing. Result is a temp folder output at the end of build. Open it with XCode to see the mangled 
path in the build phases of the React-bridging pod.

### Manual fix

If you change the copy phase of the `React-bridging` pod to an absolute path of 
`$(PODS_ROOT)/Headers/Private/React-bridging/react/bridging`
the headers get copied to the correct location. This fixes building of the pods project but the main project still
fails.

Add `$(PODS_ROOT)/Headers/Private/React-bridging` to the main project header search paths and the project will finally
build.

## Possibly related issues

https://github.com/facebook/react-native/issues/34102

https://github.com/CocoaPods/CocoaPods/issues/2382

https://github.com/CocoaPods/CocoaPods/issues/6603

https://github.com/CocoaPods/CocoaPods/pull/9451

https://github.com/CocoaPods/CocoaPods/issues/5790

## pnpm setup

To make pnpm work with react-native there are a couple of changes to the expo defaults for this project

1. `metro.config.js`
   uses [@rnx-kit/metro-resolver/symlinks](https://github.com/microsoft/rnx-kit/tree/main/packages/metro-resolver-symlinks#readme)
   to work around lack of symlink support in metro
2. `.npmrc` contains a couple `public-hoist-pattern` entries to ensure some undeclared dependencies are resolvable in
node_modules. 
3. There are a few dependencies added to devDependencies since pnpm doesn't allow undeclared dependencies to be
resolved, they need to be stated explicitly instead of hopefully/maybe installed as a transitive dep.

## Fixes attempted

1. `patches/react-native@0.69.5.patch` fixes the header path of `React-bridging` per [react-native #34102](https://github.com/facebook/react-native/issues/34102)
2. `update_ios_podfile_plugin.js` modifies the `Podfile` to work around [CocoaPods #5970](https://github.com/CocoaPods/CocoaPods/issues/5790)
   (not sure if entirely necessary)

Per the above reproduction description the build can be made to work by manually fixing the copy step of the 
`React-bridging` pod and manually adding a header search path to the root project.

I'm not sure how to apply proper fixes for either of those issues.

### Environment info
```
System:
    OS: macOS 12.5.1
    CPU: (10) arm64 Apple M1 Pro
    Memory: 234.75 MB / 16.00 GB
    Shell: 0.68.1 - /Users/imagio/.cargo/bin/nu
  Binaries:
    Node: 16.17.0 - ~/Library/Caches/fnm_multishells/47864_1663586667411/bin/node
    Yarn: 1.22.19 - ~/Library/Caches/fnm_multishells/47864_1663586667411/bin/yarn
    npm: 7.18.1 - ~/Library/Caches/fnm_multishells/47864_1663586667411/bin/npm
    Watchman: Not Found
  Managers:
    CocoaPods: 1.11.3 - /Users/imagio/.asdf/shims/pod
  SDKs:
    iOS SDK:
      Platforms: DriverKit 21.4, iOS 16.0, macOS 12.3, tvOS 16.0, watchOS 9.0
    Android SDK: Not Found
  IDEs:
    Android Studio: Dolphin 2021.3.1 Dolphin 2021.3.1
    Xcode: 14.0/14A309 - /usr/bin/xcodebuild
  Languages:
    Java: 17.0.4.1 - /usr/bin/javac
  npmPackages:
    @react-native-community/cli: Not Found
    react: 18.0.0 => 18.0.0
    react-native: 0.69.5 => 0.69.5
    react-native-macos: Not Found
  npmGlobalPackages:
    *react-native*: Not Found
```