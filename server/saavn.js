// Compatibility alias: /api/saavn and every legacy import now resolve to the
// pure YouTube Music InnerTube handler. No other provider is reachable here.
export {
  createYtmusicHandler as createSaavnHandler,
  ytmusicHandler as saavnHandler,
} from './ytmusicHandler.js'
export { ytmusicHandler as default } from './ytmusicHandler.js'
