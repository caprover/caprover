import React, { Component } from "react";
import { Provider } from "react-redux";
import { createStore, applyMiddleware } from "redux";
import { Route, Switch, HashRouter } from "react-router-dom";
import thunk from "redux-thunk";

import "./App.css";

import reducers from "./reducers";

import PageRoot from "./containers/PageRoot";
import Login from "./containers/Login";
import CrashReporter from "./utils/CrashReporter";

CrashReporter.getInstance().init();

const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);

class App extends Component {
  render() {
    return (
      <div className="full-screen-bg">
        <Provider store={createStoreWithMiddleware(reducers)}>
          <HashRouter>
            <Switch>
              <Route path="/login/" component={Login} />
              <Route path="/" component={PageRoot} />
            </Switch>
          </HashRouter>
        </Provider>
      </div>
    );
  }
}

export default App;
