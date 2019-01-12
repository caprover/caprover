import { DEFAULT_REGISTRY_CHANGED } from "../actions/DefaultRegistryActions";

export default function(state = {}, action: { payload: any; type: string }) {
  switch (action.type) {
    case DEFAULT_REGISTRY_CHANGED:
      return { ...state, defaultRegistryId: action.payload };
    default:
      return state;
  }
}
