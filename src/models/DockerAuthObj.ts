export interface DockerAuthObj {
    serveraddress: string
    username: string
    password: string
    // email: string // Email is optional in auth
}

/*
{
  "docker.example.com": {
    "username": "janedoe",
    "password": "hunter2"
  },
  "https://index.docker.io/v1/": {
    "username": "mobydock",
    "password": "conta1n3rize14"
  }
}
*/
export interface DockerRegistryConfig {
    [serveraddress: string]: {
        username: string
        password: string
    }
}
