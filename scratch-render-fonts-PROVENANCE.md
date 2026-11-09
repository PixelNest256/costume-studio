# Font bundle provenance / redistribution review

This note records the exact font assets bundled by `scratch-render-fonts@1.0.256`
and their embedded name-table licensing metadata. It is not a substitute for the
full font licenses and does not assert a license where upstream metadata is
unclear.

| Font file | Copyright / license metadata | Distribution status in Costume Studio |
| --- | --- | --- |
| `NotoSans-Medium.ttf` | Copyright 2015 Google Inc.; SIL OFL 1.1 metadata | Bundled via browser-safe subset; OFL.txt included |
| `SourceSerifPro-Regular.otf` | Copyright 2014–2016 Adobe Systems; SIL OFL 1.1 metadata | Bundled via browser-safe subset; OFL.txt included |
| `handlee-regular.ttf` | Copyright 2011 Admix Designs; SIL OFL 1.1 metadata | Bundled via browser-safe subset; OFL.txt included |
| `Knewave.ttf` | Copyright 2011 Tyler Finck; metadata says OFL | **Not bundled**: the package OFL file does not appear to be Knewave's applicable license, so this project does not assume coverage. `Marker` falls back to Sans Serif. |
| `Griffy-Regular.ttf` | Copyright 2012 Font Diner, Inc.; embedded SIL OFL 1.1 notice | **Not bundled**: the upstream OFL file is for Londrina and the exact applicable license copy has not been verified. `Curly` falls back to Sans Serif. |
| `Grand9K-Pixel.ttf` | Copyright 2009–2013 Grand Chaos Productions; author Jayvee D. Enaguas; embedded link to CC BY-SA 3.0 | **Not bundled**: required full license text has not been verified and included. `Pixel` falls back to Sans Serif. |
| `Scratch.ttf` | Copyright/name metadata identifies Jakob Fischer / PizzaDude; no redistribution license embedded | **Not bundled**. Upstream `scratch-render-fonts` issue [#23](https://github.com/scratchfoundation/scratch-render-fonts/issues/23) states Scratch Foundation has permission to use it, but not to redistribute it. The editor's legacy `Scratch` font family therefore falls back to Sans Serif. |

The upstream npm package includes an Apache-2.0 `LICENSE.txt`, but its package
terms do not override separate licenses/permissions for contained font files.
`src/vendor/scratch-render-fonts.js` includes only three assets whose embedded
metadata identifies SIL OFL 1.1, alongside the package's `OFL.txt`. The legacy
`Scratch`, `Pixel`, `Marker`, and `Curly` family names are mapped to Sans Serif
during SVG font inlining. This is a conservative packaging choice, not a legal
opinion about the omitted assets.
