module.exports = function (eleventyConfig) {

    // --- Passthrough copies -------------------------------------------
    // CSS, JS and page-specific data files are not processed by Eleventy;
    // just copy them straight to _site/.
    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/js");
    eleventyConfig.addPassthroughCopy("src/data"); // iRacing JSON for client fetch

    // img/ lives at the repo root (not inside src/) — copy it as-is
    eleventyConfig.addPassthroughCopy({ "img": "img" });

    // --- Filters ---------------------------------------------------------
    // Zero-pad a number: {{ loop.index | zeroPad(2) }} → "01"
    eleventyConfig.addFilter("zeroPad", (value, length) =>
        String(value).padStart(length || 2, "0")
    );

    // --- Config ----------------------------------------------------------
    return {
        dir: {
            input:    "src",
            output:   "_site",
            includes: "_includes",
            layouts:  "_layouts",
            data:     "_data",
        },

        // Use bare / for local dev; repo subpath on GitHub Pages.
        // GITHUB_ACTIONS env var is set automatically by GitHub Actions.
        pathPrefix: process.env.GITHUB_ACTIONS ? "/homepage-refresh/" : "/",
    };
};
