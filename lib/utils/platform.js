// Platform detection + per-screen renderer dispatch (mobile vs web).
// Single place that reads state.client; screens call renderForPlatform() once
// instead of scattering isMobile() ternaries through their markup.
// See ../../REQUIREMENTS.md §9.1 and docs/frontm-ai-platform-detection-client-types-guide.md.
// NOTE: skeleton placeholders — implemented during the core-apps (B2) build.

import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";

// True on native mobile clients (iOS/Android).
export const isMobile = () =>
  state.client === ALL_CONSTANTS.CLIENTS.MOBILECLIENT;

// True on web browsers.
export const isWeb = () => state.client === ALL_CONSTANTS.CLIENTS.WEBCLIENT;

// One dispatch point per screen: pick the platform's renderer and run it on the
// shared, already-prepared `data`. `web` and `mobile` are functions: data -> HTML.
export const renderForPlatform = (data, renderers) =>
  (isMobile() ? renderers.mobile : renderers.web)(data);
