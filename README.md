# matrix-channel-codeformuenster
Iframe, der den Inhalt aus unserem Matrix-Channel auf der CodeForMünster Homepage anzeigt.

## Install

```bash
npm install
cp config.js.dist config.js
node index.js

# ------------
# the script will now echo a very long base64 encoded token string
# copy the token to config.js
# ------------

# use the following command in cronjob every 10 mins,
# it will update "public/index.html" every time
node index.js
```

## Nützliche Links

* Copy&Paste-Anleitung zur Nutzung der Matrix.org API: https://matrix.org/docs/guides/creating-a-simple-read-only-matrix-client
* Unser Matrix Channel: https://view.matrix.org/room/!tuOLfhLLphPDUwtDmC:matrix.org/
* Schnell-Lern-Kurs für Javascript: https://hyperpolyglot.org/scripting