# DiscordNT Server
As of now, there basically nothing. this app is inteaded to run as a console app although it has no issues being ran graphically.

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

Currently, auto-startup isnt supported at all. this will *hopefully* be implemented soon however.