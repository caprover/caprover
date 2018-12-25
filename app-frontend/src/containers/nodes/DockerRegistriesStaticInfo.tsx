import React, { Component } from "react";
import { Collapse } from "antd";

export default class DockerRegistriesStaticInfo extends Component {
  render() {
    return (
      <div>
        <p>
          Setting up Docker Registry is <b>only required</b> if you plan to run
          your Captain on a cluster. For single node Captain deployments, Docker
          Registry is not recommended as it makes deployment significantly
          slower.
        </p>
        <Collapse>
          <Collapse.Panel header="More info" key="1">
            <p>
              Docker registry is a repository for your built images. It is
              similar to Github, or Bitbucker, with private repositories.
              However, instead of source code, it contains the built artifacts
              for your application. It is required for cluster mode, as other
              nodes need to access the built image in order for your application
              to run on them.
            </p>
            <p>
              Captain provides two methods for you to setup your docker
              registry:
            </p>
            <ul>
              <li>
                <b>Self hosted Docker Registry:</b> This is the simplest way to
                setup a docker registry. Captain creates an instance of Docker
                Registry on the main machine and it manages the registry for
                you. However, it has its own limitation. If your main machine is
                destroyed, your local images will be lost. In most cases, this
                is not a disaster as you can re-deploy your apps from your
                source code.
                <br />
              </li>
              <li>
                <b>Remote Docker Registry:</b> This approach relies on a remote
                service to act as your Docker Registry. Using this approach,
                you'll have a more reliable cluster, assuming the third party
                service you use is reliable! There are multiple private Docker
                Registry services available: Google Container Registry, Amazon
                EC2 Container Registry, Quay and etc. Note that this approach
                costs you money.
              </li>
            </ul>
          </Collapse.Panel>
        </Collapse>
      </div>
    );
  }
}
