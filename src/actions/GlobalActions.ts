export const ROOT_KEY_CHANGED = "ROOT_KEY_CHANGED";

export function emitRootKeyChanged() {
  return {
    type: ROOT_KEY_CHANGED,
    payload: {}
  };
}
