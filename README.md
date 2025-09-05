# DiscordNT Server
As of now, there is basically nothing. this app is inteaded to run as a console app although it has no issues being ran graphically.

## Features
- [x] Message push notifications
- [ ] Activities LAN Service
- [x] Xaero's minimap waypoint auto-import

## Seting up and Running
> The directory that you run this app in MUST be the same as the directory you want `config.json`, `default.png`, and the `/users` folder to go into.

> This app currently stores your token in **__plane text__** with completely open access. use at your own risk!!!

> The account token is logged on first start up, please make sure to always remove it before uploading any log outputs of this app!!!

To initialize the server you need to
### Get your discord account token
- goto https://discord.com/app
- login to the account you wish to link to this server
- open inspect element (F12 or ctrl + shift + C)
- open the `Network` tab (if its not there, check inside the `>>` menu in the tab bar)
- set the network requests filter to `XHR`/`Fetch`
- send a message in any channel
- select the most recent request, or the request marked `messages` if the following cant be performed
- look for the entry `Authorization`, if you cant find it retry on the request marked `messages`
- copy the token inside the value
### Run the server
- open your terminal app (`cmd.exe` or `Command Prompt` on windows)
- cd to the directory you have the server executable stored at
- run `./server` with the token you got previously, make sure to wrap your token in quotation marks.
- after this you should eventually see the notification `Successfully connected to the discord gateway.` which means that the server has started successfully and you can omit the token on any further executions.
- if you instead see `Couldnt connect to the discord gateway. Closing server.`, then either discord wont let the server connect or the provided token is invalid. try the steps over again just to be sure, and after that please open an issue at https://github.com/RedMan13/discordnt/issues.

Currently, setting up auto-startup isnt here at all. instead you need to manually setup a secondary script to set the current working directory to the correct folder.

# TODO
- [x] Message rendering
  - [x] User name, badges, and role icon rendering (with role color)
  - [x] User profile picture and decoration
  - [x] Text content
  - [x] Graphical attachments
  - [ ] Pure text attachments
  - [ ] Generic attachments
  - [x] Reply content
  - [ ] Poll messages
  - [x] Embeds
  - [ ] Message forwarding
- [x] Server rendering, and selection
- [x] Text channel rendering, and selection
- [ ] Message searching
- [ ] Members list
- [ ] Server profile previewing
- [ ] Global profile previewing
- [ ] Pins listing
- [ ] Message management
- [ ] Server management
- [ ] Voice chatting
- [ ] Friends list management
- [ ] Private messages
- [ ] Working login page
- [ ] Account settings control
- [ ] Application presence based activities