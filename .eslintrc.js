// eslint-disable-next-line no-undef
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    "rules": {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "no-case-declarations": "off",
        "no-useless-escape": "off",

    }
};