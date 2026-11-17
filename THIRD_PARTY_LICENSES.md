# Third-Party Software and Font Licenses

ScoreForge uses third-party open-source libraries and digital assets. This document provides attribution, copyright notices, and license information for all production runtime dependencies, build-time typography tools, and musical font assets.

---

## Summary of Production and Asset Licenses

| Component / Package | Version | License | Copyright / Author | Purpose |
|---------------------|---------|---------|--------------------|---------|
| **Bravura (SMuFL)** | 1.392 | SIL OFL 1.1 | (c) 2014-2023 Steinberg Media Technologies GmbH | Reference SMuFL music font & glyph metadata |
| **react** | 18.3.1 | MIT | (c) Meta Platforms, Inc. and affiliates | UI rendering engine |
| **react-dom** | 18.3.1 | MIT | (c) Meta Platforms, Inc. and affiliates | DOM bindings for React |
| **immer** | 10.2.0 | MIT | (c) 2017 Michel Weststrate | Immutable score state manipulation with structural sharing |
| **tone** | 15.1.22 | MIT | (c) Yotam Mann | Web Audio playback, scheduling, and polyphonic synthesis |
| **standardized-audio-context** | 25.3.77 | MIT | (c) Christoph Guttandin | Cross-browser Web Audio API normalization (transitive via tone) |
| **automation-events** | 7.1.19 | MIT | (c) Christoph Guttandin | Web Audio parameter automation curves (transitive via tone) |
| **scheduler** | 0.23.2 | MIT | (c) Meta Platforms, Inc. and affiliates | Cooperative task scheduling (transitive via react) |
| **tslib** | 2.9.1 | 0BSD | (c) Microsoft Corporation | TypeScript runtime helper functions (transitive via tone) |
| **loose-envify** | 1.4.0 | MIT | (c) Andres Suarez | Node environment variable replacement (transitive via react) |
| **js-tokens** | 4.0.0 | MIT | (c) Simon Lydell | Regular expressions for JavaScript tokenizing (transitive via react) |
| **@babel/runtime** | 7.29.13 | MIT | (c) Babel Team and contributors | Modular runtime helpers (transitive via standardized-audio-context) |
| **opentype.js** (build tool) | 2.0.0 | MIT | (c) Frederik De Bleser | Build-time glyph vector extraction from Bravura.otf |

---

## 1. Bravura Font and SMuFL Metadata

**Font Name:** Bravura  
**Designer:** Daniel Spreadbury (Steinberg Media Technologies GmbH)  
**License:** SIL Open Font License, Version 1.1 (OFL-1.1)  
**Copyright:** Copyright (c) 2014-2023 Steinberg Media Technologies GmbH (<http://www.steinberg.net>).  

### SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE  
The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and redistributed freely but not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

DEFINITIONS  
"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the copyright statement(s).

"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or substituting — in part or in whole — any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS  
Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.
2) Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.
3) No Modified Version of the Font Software may use the Reserved Font Name(s) unless prominent written permission is granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.
4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.
5) The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.

TERMINATION  
This license becomes null and void if any of the above conditions are not met.

DISCLAIMER  
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

---

## 2. MIT License (React, ReactDOM, Immer, Tone, OpenType.js, etc.)

The following packages are licensed under the MIT License:
- `react`, `react-dom`, `scheduler`, `loose-envify`, `js-tokens`
- `immer`
- `tone`, `standardized-audio-context`, `automation-events`, `@babel/runtime`
- `opentype.js`

### MIT License Text

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## 3. BSD Zero Clause License (tslib)

Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
