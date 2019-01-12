export const DEFAULT_REGISTRY_CHANGED = "DEFAULT_REGISTRY_CHANGED";

export function emitDefaultRegistryChanged(value: string | undefined) {
  return {
    type: DEFAULT_REGISTRY_CHANGED,
    payload: value
  };
}
