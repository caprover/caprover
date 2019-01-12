import { ROOT_KEY_CHANGED } from "../actions/GlobalActions";
import Utils from "../utils/Utils";

export default function(state = {}, action: { payload: any; type: string }) {
  switch (action.type) {
    case ROOT_KEY_CHANGED:
      return { ...state, rootElementKey: Utils.generateUuidV4() };
    default:
      return state;
  }
}
