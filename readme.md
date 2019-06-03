# Simply Serve Me (SSME)
Struggling with hosting node servers under Apache2 and never got around NginX I decided to build my own webserver in Node.

Since I started to get alot of node web applications running on the same machine and all of them under different port I wanted to proxy them all under port 80 and thats how I came up with SSME.

Suggested is to install SSME globally:
`> npm install simplyserveme g`

Start the application with `> ssme start`

## Config
SSME utilize configs, looking for ssme.config.json at the same directory as the application is started. However if no file is found it will fallback to default values. The config can also be created using command `> ssme init`. 

### Attributes
- **Port** (integer) - *Port to run HTTP server*
- **sslPort** (integer) - *Port to run HTTPS Server*
- **logOutputConsole** (boolean) - *Should SSME output log in console?*
- **logDumpPath** (string) - *Path to put log file*
- **hostsPath** (string) - *Path to host config folder*

This is the default config:
```
{
    "port": 80,
    "sslPort": 443,
    "logOutputConsole": false,
    "logDumpPath": "~/.ssme/log",
    "hostsPath": "~/.ssme/hosts"
}
```

## Hosts
Each website domain is represented as a file in the config "hostPath" folder. Name each host file %DOMAIN%.json

### Attributes
- **domain** (string) - *What domain to run host at*
- **target** (string) - *URL or path to proxy from*
- **enable** (boolean) - *Should the host currently be available (true) or not (false)?*
- **security** (optional)
  - **key** (string) - *Path to key file*
  - **cert** (string) - *Path to cert file*
  - **ca** (string) - *Path to ca file*
- **redirectToHttps** (boolean) - *If "security" is specified should all http request be redirected to http (true) or not (false)?*
- **letsEncryptAuth** (optional) - *Validation configs when letsEncrypt needs to authenticate host*
  - **validation** (string)
  - **token** (string)
- **blackListIps** (string Array) (optional) - *List of IP-addresses that should be denied access (CIDR allowed)*
- **whiteListIps** (string Array) (optional) - *List of IP-addresses that should be allowed access  (CIDR allowed)*

If "blackListIps" is present all IP:s will be allowed access except the ones in the list.

If "whiteListIps is present ONLY IP:s in the list will be allowed access.

If both "blackListIps" and "whiteListIps" is present ONLY IP:s in the "whiteListIps" list will be allowed access EXCEPT if it also is present in the "blackListIps" list. 

Example of host file:
```
{
  "domain": "site.app.com",
  "target": "http://site.app.com:1234",
  "enable": true,
  "whiteListIps": ["127.0.0.1"]
}
```
Setting the "target" to a system path will work as serving static content.

## LetsEncrypt
SSME Support SSL using letsEncrypt. Example of host using LetsEncrypt certificate would look like this:
```
{
  "domain": "site.domain.com",
  "target": "http://site.domain.com:1234",
  "security": {
    "cert": "/etc/letsencrypt/live/site.domain.com/cert.pem",
    "key": "/etc/letsencrypt/live/site.domain.com/privkey.pem",
    "ca": "/etc/letsencrypt/live/site.domain.com/chain.pem"
  },
  "redirectToHttps": true
}
```
LetsEncrypt with certbot require validation of host when creating a certificate. This is what the attribute "letsEncryptAuth" comes in use.

To make everyting less complicated SSME supports commands to set validation and cert paths with the certboot hooks. To create a certificate for a specific host with certbot (with validation and certificate configs) simply run:
```
> certbot certonly --manual -d %DOMAIN% --manual-auth-hook "ssme auth" --manual-cleanup-hook "ssme cleanup"
```
the hook `> ssme auth` will rewrite host file (from env vars) with validation and `> ssme cleanup` will remove validation and add "security" data to host config file (using env vars).

## Hot Reloading
Adding, deleting and editing config and/or hosts will reload the server automatically. No need to restart the application.

## Run on port 80/443
If you wanna run SSME on a port less than 1024 and avoid running under root we recommend using [authbind](http://manpages.ubuntu.com/manpages/bionic/man1/authbind.1.html).

## CLI
The application comes with a simple CLI. Commands available are:

### Start
```
> ssme start
```
Start application web server

### Init
```
> ssme init
```
Create init config file in active folder

### List
```
> ssme list
```
List all configs

### Create
```
> ssme create <domain> <target>
```
Create a new host config with specified domain and target. 

### Enable/Disable
```
> ssme enable <domain>
> ssme disable <domain>
```
Will enable/disable domain to be hosted

### LetsEncrypt
```
> ssme auth
> ssme cleanup
```
To be used with certbot to create authentication for host config and set certificate. [Read more about it here](https://certbot.eff.org/docs/using.html#pre-and-post-validation-hooks).

## Server module
As a final touch this package include a server module for quickly setting up a web server in nodejs. The server module is able to run multiple web apps were each app is either an API or a SPA.

A server is created like this:
```
import { Router } from "express";
import { Server } from "simplyserveme";

const apps = [
  //API app
  { domain: "api.app.com", routes: Router(), },
  { domain: "spa.app.com", staticPath: "/path/to/static/root" }
];

new Server(apps, port, securePort);
```
More configs like cors and credentials and other stuff can be found in the ts definition file.
