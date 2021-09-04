/* eslint-disable no-undef */
module.exports = {
    transform: {
        "^.+\\.tsx?$": "ts-jest",
        "^.+\\.ts?$": "ts-jest",
    },
    testRegex: "(/tests/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?|ts?|js?)$",
    testPathIgnorePatterns: ["/node_modules/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    collectCoverage: true,
};