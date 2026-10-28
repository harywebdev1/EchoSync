// The legacy path keeps working for every existing import while the handler
// itself lives in saavnHandler.js alongside the OmniRoute provider router.
export { createSaavnHandler, saavnHandler } from './saavnHandler.js'
export { saavnHandler as default } from './saavnHandler.js'
