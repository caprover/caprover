const {
    override,
    fixBabelImports,
    addLessLoader,
} = require("customize-cra");

module.exports = override(
    fixBabelImports("import", {
        libraryName: "antd",
        libraryDirectory: "es",
        style: true // change importing css to less
    }),
    addLessLoader({
        javascriptEnabled: true,
        modifyVars: {
            "@primary-color": "#1b8ad3",
            '@font-family': '"Google Sans", "Chinese Quote", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
        },
    })
);