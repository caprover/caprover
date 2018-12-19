import { combineReducers } from "redux";


function dummyReducer(state = { }, action:any) {
    return state;
  }

const rootReducer = combineReducers({
    dummyReducer: dummyReducer
});

export default rootReducer;
