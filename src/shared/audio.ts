export const AUDIO_STATE_KEY = "microreel.audio.state";

export interface AudioPreferenceState {
  pageMuted: boolean;
  extensionMuted: boolean;
}

export function resolveVideoMuted(audioState: AudioPreferenceState): boolean {
  return audioState.pageMuted || audioState.extensionMuted;
}
