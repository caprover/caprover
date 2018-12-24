import React, { Component } from "react";

export default class NetDataDescription extends Component {
  render() {
    return (
      <div>
        <p>
          <a
            href="https://github.com/netdata/netdata/"
            target="_blank"
            rel="noopener noreferrer"
          >
            NetData
          </a>{" "}
          is one of the most popular and most powerful monitoring tools that
          provide a web interface. It is a system for distributed real-time
          performance and health monitoring. It provides unparalleled insights,
          in real-time, of everything happening on the system it runs (including
          applications such as web and database servers), using modern
          interactive web dashboards.
        </p>
        <p>
          NetData is fast and efficient, designed to permanently run on all
          systems (physical &amp; virtual servers, containers, IoT devices),
          without disrupting their core function.
        </p>
        <p>
          Captain provides a simple interface to enable NetData on your captain
          instance. Currently, Captain only supports installing NetData on your{" "}
          <b>leader node</b>, i.e., the node where Captain instance resides.
          This limitation is due to a limitation in Docker interface,
          <a
            href="https://github.com/moby/moby/issues/25885/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {" "}
            see here
          </a>{" "}
          .
        </p>
        <p>
          <i>For more details regarding NetData, visit their </i>
          <a
            href="https://github.com/firehol/netdata/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub page
          </a>
          .
        </p>
      </div>
    );
  }
}
