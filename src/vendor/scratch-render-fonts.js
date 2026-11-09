// Browser-safe subset of scratch-render-fonts.
// Only the three fonts with confirmed SIL OFL 1.1 metadata are bundled.
// Scratch.ttf is not redistributable per upstream; other omitted fonts have
// licensing uncertainties. See scratch-render-fonts-PROVENANCE.md.
const fonts = {
    'Sans Serif': require('base64-loader!../../node_modules/scratch-render-fonts/src/NotoSans-Medium.ttf'),
    'Serif': require('base64-loader!../../node_modules/scratch-render-fonts/src/SourceSerifPro-Regular.otf'),
    'Handwriting': require('base64-loader!../../node_modules/scratch-render-fonts/src/handlee-regular.ttf')
};

const getFontDataUrl = name => (fonts[name] ?
    `data:application/x-font-ttf;charset=utf-8;base64,${fonts[name]}` :
    null);

const getFonts = () => {
    const fontStyles = {};
    for (const [name, data] of Object.entries(fonts)) {
        fontStyles[name] = `@font-face {font-family: "${name}";src: url("data:application/x-font-ttf;charset=utf-8;base64,${data}");}`;
    }
    // Map omitted legacy families to Sans Serif without redistributing their
    // respective upstream font files.
    fontStyles.Scratch = fontStyles['Sans Serif'];
    fontStyles.Pixel = fontStyles['Sans Serif'];
    fontStyles.Marker = fontStyles['Sans Serif'];
    fontStyles.Curly = fontStyles['Sans Serif'];
    if (typeof document !== 'undefined' && !document.getElementById('scratch-font-styles')) {
        const style = document.createElement('style');
        style.id = 'scratch-font-styles';
        style.textContent = Object.values(fontStyles).join('');
        if (document.body) document.body.insertBefore(style, document.body.firstChild);
    }
    return fontStyles;
};

module.exports = getFonts;
module.exports.getFontDataUrl = getFontDataUrl;
