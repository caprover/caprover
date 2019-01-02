import { combineReducers } from "redux";
import DefaultRegistryReducer from "./DefaultRegistryReducer";
import GlobalReducer from "./GlobalReducer";

const rootReducer = combineReducers({
  registryReducer: DefaultRegistryReducer,
  globalReducer: GlobalReducer
});

export default rootReducer;
