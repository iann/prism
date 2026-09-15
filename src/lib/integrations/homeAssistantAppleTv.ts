export * from './homeAssistantMediaPlayer';

export {
  estimateHomeAssistantMediaPlayerPosition as estimateHomeAssistantAppleTvPosition,
  normalizeHomeAssistantMediaPlayerState as normalizeHomeAssistantAppleTvState,
} from './homeAssistantMediaPlayer';

import {
  buildHomeAssistantMediaPlayerActionRequests,
  type HomeAssistantMediaPlayerActionInput,
  type HomeAssistantServiceRequest,
} from './homeAssistantMediaPlayer';

/**
 * Compatibility wrapper for callers that relied on the original Apple TV
 * two-step sleep contract, which required a remote entity.
 */
export function buildHomeAssistantAppleTvActionRequests(
  input: HomeAssistantMediaPlayerActionInput,
  mediaPlayerEntityId: string
): HomeAssistantServiceRequest[] {
  if (input.control === 'turn_off' && !input.remoteEntityId)
    throw new Error('Invalid Home Assistant entity ID');
  return buildHomeAssistantMediaPlayerActionRequests(input, mediaPlayerEntityId);
}

export type {
  HomeAssistantMediaPlayerActionInput as HomeAssistantAppleTvActionInput,
  HomeAssistantMediaPlayerState as HomeAssistantAppleTvState,
  SupportedMediaPlayerControl as SupportedAppleTvControl,
} from './homeAssistantMediaPlayer';
