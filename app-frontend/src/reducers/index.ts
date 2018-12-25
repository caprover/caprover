import { combineReducers } from "redux";
import DefaultRegistryReducer from "./DefaultRegistryReducer";

const rootReducer = combineReducers({
  registryReducer: DefaultRegistryReducer
});

export default rootReducer;
