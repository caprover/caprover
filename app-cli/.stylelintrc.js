module.exports = {
  extends: "stylelint-config-sass-guidelines",
  rules: {
    "no-descending-specificity": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["global"]
      }
    ],
    "selector-class-pattern": null,
    "max-nesting-depth": null,
    "color-named": null,
    "declaration-property-value-blacklist": null,
    "selector-no-qualifying-type": null,
    "selector-max-compound-selectors": null,
    "property-no-vendor-prefix": null,
    "selector-max-id": null,
    "scss/selector-no-redundant-nesting-selector": null,
    "string-quotes": "double",
    "scss/at-import-no-partial-leading-underscore": null,
    "scss/at-extend-no-missing-placeholder": null,
    "scss/at-mixin-pattern": null
  }
};
