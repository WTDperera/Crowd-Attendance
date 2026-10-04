# P09 visual baseline review

Reviewed by the agent on 2026-10-04 with `view_image`: login and empty Add Student at **1280 × 900**, Windows, headless Chromium **153.0.8010.12**, Playwright **1.63.0**, locale en-GB and Asia/Colombo. Both images show the expected form, readable labels/actions, complete sidebar where applicable and no clipping or overlay. This is an agent baseline review, not human usability acceptance.

`login-win32.png` and `add-student-win32.png` contain no real account data. Browser requests are restricted to the explicit local QA ports; remote font/CDN requests are blocked. Rendering uses the existing app styles and available Windows fonts. Empty forms avoid dynamic dates, names, login history and counters. Animations are disabled for capture. Comparisons allow **zero differing pixels using Playwright's default pixel threshold**; the screenshots are not a cross-platform baseline.

Two subsequent full browser runs passed without updating the images. To change an intentional visual result, regenerate only the core-screen case, inspect both PNGs, record the reason and verify a subsequent run without `--update-snapshots`. See [Playwright visual comparison documentation](https://playwright.dev/docs/test-snapshots) and [P09 evidence](../../reports/P09.md). These two web screenshots satisfy the small visual baseline scope; Android goldens are not claimed.
