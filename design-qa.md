# Design QA — mobile assistant composer

## Visual truth

- Source defect screenshot: `/tmp/codex-remote-attachments/01a0495f-fd2e-7342-8a25-cc9417972761/D58CBF57-36B2-4DCF-A48B-97D9AEC87B89/1-照片-1.jpg`
- Implementation full-view screenshot: `frontend/e2e/test-results/cross-responsive-responsiv-70ed4-ntrols-compact-and-readable-mock-chromium/mobile-assistant-page.png`
- Implementation focused screenshot: `frontend/e2e/test-results/cross-responsive-responsiv-70ed4-ntrols-compact-and-readable-mock-chromium/mobile-assistant-composer.png`
- Source image dimensions: 590 × 1280 px. This is a mobile Safari capture of the broken production state; its browser chrome and unknown export scaling prevent exact CSS-pixel normalization.
- Implementation viewport: Playwright Pixel 7 profile, 412 × 839 CSS px at device scale factor 2.625.
- Implementation image dimensions: full view 1082 × 2202 px; focused composer 992 × 326 px. The focused composer is approximately 378 × 124 CSS px after density normalization.

## State under test

- Flow page, `对话助手` tab selected.
- Provider selected.
- Both `使用智能体` and `允许控制自动执行` switches rendered.
- Narrow mobile viewport where the regression occurred.

## Comparison history

### Iteration 1 — before

- P1: the bottom add-on stayed on one non-wrapping row.
- P1: the switch group was compressed to nearly zero width, so Chinese labels wrapped one glyph per line.
- P1: vertical labels inflated the composer to roughly the height of a large content card and obscured its hierarchy.

### Iteration 1 — after

- The add-on wraps intentionally on narrow screens.
- Provider selection remains on the primary control row and truncates safely.
- The switch group moves to a dedicated full-width row below it on mobile.
- Both switch labels are non-wrapping and remain horizontal.
- At `sm` and wider breakpoints the controls retain the compact single-row desktop behavior.
- Automated geometry assertion: composer height ≤ 160 CSS px; observed focused capture height ≈ 124 CSS px.
- Automated overflow assertion: no document-level horizontal overflow.
- Automated readability assertion: each Chinese switch label is wider than it is tall.

## Visual QA findings

- Overall composition and hierarchy: passed. The composer is compact and clearly separated into input, provider/action, and switch controls.
- Spacing and alignment: passed. Controls have consistent horizontal and vertical gaps without collision.
- Typography and copy: passed. Existing text styles and Chinese copy were preserved; labels no longer stack vertically.
- Color, icons, and assets: passed. Existing design tokens and vector icons were preserved; no new raster assets were introduced.
- Functional state: passed. Provider menu, overflow menu, submit/stop control, and both switches remain present.
- Responsive behavior: passed at the Pixel 7 mobile profile, with breakpoint-specific desktop behavior preserved by `sm:` classes.
- Note: the existing floating `中文界面` badge remains independent of the composer and was not changed by this layout fix.

## Final result

passed
