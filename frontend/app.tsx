import * as React from "react";
import * as ReactDOM from "react-dom";
import { Router, Route, Switch } from "react-router";
import history from "./lib/history";
import { User } from "./lib/user";

import "./less/entry.less";

import Home from "./routes/home";

interface Props {}
interface State {
  injectWeb3: boolean;
  user: User;
}
class App extends React.Component<Props, State> {
  state = {
    injectWeb3: false,
    user: null
  };
  componentDidMount() {
    if (typeof window["web3"] === "undefined") {
      alert("metamask not installed");
    } else {
      console.log("metamask installed");
      this.setState({
        injectWeb3: true,
        user: new User(window["web3"])
      });
    }
  }
  render() {
    return (
      <Router history={history}>
        <div id="router-container">
          <Route
            path="/"
            render={props => <Home user={this.state.user} />}
            exact
          />
        </div>
      </Router>
    );
  }
}

ReactDOM.render(<App />, document.getElementById("root"));
