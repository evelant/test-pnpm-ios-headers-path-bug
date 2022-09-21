const { withDangerousMod, withPlugins } = require("@expo/config-plugins")
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode")
const fs = require("fs")
const path = require("path")

async function readFileAsync(path) {
    return fs.promises.readFile(path, "utf8")
}

async function saveFileAsync(path, content) {
    return fs.promises.writeFile(path, content, "utf8")
}

const withUseFrameworksHacks = (c) => {
    return withDangerousMod(c, [
        "ios",
        async (config) => {
            const file = path.join(config.modRequest.platformProjectRoot, "Podfile")
            const contents = await readFileAsync(file)
            await saveFileAsync(file, addUseFrameworksHacks(contents))
            return config
        },
    ])
}

function addUseFrameworksHacks(src) {
    src = mergeContents({
        tag: `rn-firebase-use-frameworks-hacks`,
        src,
        newSrc: `$RNFirebaseAsStaticFramework = true`,
        anchor: /platform :ios/,
        offset: 0,
        comment: "#",
    }).contents

    src = mergeContents({
        tag: `rn-firebase-use-frameworks-hacks-header-paths`,
        src,
        newSrc: `
        #Fix bug where headers get set as "Project" files instead of "Public" when cocoapods traverses symlinks
   installer.pods_project.targets.each do |target|
        puts "target ? #{target.name}"
        if (target.respond_to?(:headers_build_phase) && target.name.include?("React-bridging"))
            puts "target has headers build phase, setting public attrs"
            target.headers_build_phase.files.each do |file|
                puts "setting attributes on header build phase #{file.file_ref.name}"
                file.settings = { 'ATTRIBUTES' => ['Public'] }
             end
        end
    end

  #Fix search paths for React-bridging 
installer.target_installation_results.pod_target_installation_results.each do |pod_name, target_installation_result|
  target_installation_result.native_target.build_configurations.each do |config|
    # For third party modules who have React-bridging dependency to search correct headers
    config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited) '
    config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Private/React-bridging" '
    config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/React-bridging/_.framework/Headers" '
  end
end
        `,
        anchor: /react_native_post_install\(installer\)/,
        offset: 0,
        comment: "#",
    }).contents
    return src
}

module.exports = (config) => withPlugins(config, [withUseFrameworksHacks])
