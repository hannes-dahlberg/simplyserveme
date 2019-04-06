# Simply Serve Me (SSME)
Struggling with hosting node servers under Apache2 and never got around NginX I decided to build my own webserver in Node.

Since I started to get alot of node web applications running on the same machine and all of them under different port I wanted to proxy them all under port 80 and thats how I came up with SSME.

## Configs
Each website hosted should be represented under ~/.ssme/site.domain.com.json but ofcourse named after your own domain.

Example of config file:
```
{
  "domain": "site.app.com",
  "target": "http://site.app.com:1234"
}
```
The target can also be an absolut path to a static folder for simply serving static content.

## LetsEncrypt
SSME also support SSL using letsEncrypt. Just create a certificate using certbot manual creating tool and edit your config to:
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
`RedirectToHttps` when `true` will redirect any none https request.

You can also use certbots manual hooks to auth and cleanup a SSME host config directly. Example:
```
ertbot certonly --manual -d %DOMAIN% --manual-auth-hook "ssme --auth" --manual-cleanup-hook "ssme --cleanup"
```

## Hot Reloading
Adding, deleting and editing configs will reload the server automatically so my tip is to run SSME under forever or any other daemon type service.

## Run as root
Also SSME requires root access to run since its using port 80 and 443,

Suggestion is to install SSME globally under your own login and then run it with SUDO (will utilize the same config folder).

## CLI
The application comes with a simple CLI as well. These are the following commands:

### Create
```
ssme --create --domain %DOMAIN% --target %TARGET%
```
This will create a new host config with specified domain and target. 

### List
```
ssme --list
```
Will ist all configs

### Enable/Disable
```
ssme --enable --domain %DOMAIN%
ssme --disable --domain %DOMAIN%
```
Will enable/disable to domain to be hosted