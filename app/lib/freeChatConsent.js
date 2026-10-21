/**
 * Consent copy for the Stream Chat Lite free-widget signup, shared between
 * server code (free-chat-widget.confirm route, freeChatConfirm.server.js)
 * and the client-rendered form (free-chat-widget.jsx). Deliberately NOT in
 * a `.server.js` file: React Router strips everything except
 * loader/action/middleware/headers from a `.server` module's client bundle,
 * and this text is rendered directly in the signup form component.
 *
 * Bump CONSENT_VERSION if this text ever changes, so a stored consent
 * record always says which version was agreed to.
 */
import {brand} from './brand.config.js';

export const CONSENT_VERSION = 'free-chat-v1';
export const CONSENT_TEXT = `Get Stream Chat Lite free by joining the ${brand.name} email list. Unsubscribe anytime, your widget keeps working.`;
