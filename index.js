const axios = require('axios');
const fs = require('fs');
const config = require('./config');

console.log("START .. script time:", new Date().toISOString());

const MATRIX_API_SERVER = config.matrix_api_url;
if (!MATRIX_API_SERVER) {
  console.error("No Matrix API server Url in config");
  process.exit()
}


async function getMatrixApiToken() {
  var url = MATRIX_API_SERVER + "/register?kind=guest";
  const res = await axios.post(url, {});
  const { data } = await res;
  console.log("getToken response:", data);
  return data.access_token;
}

async function getRoomId(roomName) {
  // we know that if the first character is a '#', we have an alias not an id
  if (roomName[0] === "#") {
    var getIdUrl = MATRIX_API_SERVER + "/directory/room/";
    getIdUrl += encodeURIComponent(roomName);
    const res = await axios.get(getIdUrl);
    const { data } = await res;
    console.log("getRoomId response", data);
    return data.room_id;
  }
  return roomName;
}

async function loadScriptFromEventId(roomId, accessToken) {
  const url = MATRIX_API_SERVER + `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=10&access_token=${accessToken}`;
  const res = await axios.get(url);
  const { data } = await res;
  // console.log("startId response", data)
  return data.chunk
}

function htmlentities(rawStr) {
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function(i) {
    return '&#'+i.charCodeAt(0)+';';
  });
}


async function main() {
  try {
    // define the codeformünster-events channel name in the config
    const roomName = config.matrix_room_name;

    // if token is invalid, use the getMatrixApiToken() method to get a new one
    var token = config.matrix_api_token;
    if (!token) {
      token = await getMatrixApiToken();
    }

    const roomId = await getRoomId(roomName);
    const messages = await loadScriptFromEventId(roomId, token);

    RESPONSE_HTML = '<html><head><title>CodeforMünster Events Matrix Channel</title>'
    + '<style>i {background-color:#ccc;}'
    + '.container div {margin: 1px 5px;background-color: #eee;border-radius: 10px;  }'
    + 'b, i, span {display: inline-block;padding: 0 5px;border-radius: 5px;}'
    + '.container {height: 200px;overflow: auto;display: flex;flex-direction: column-reverse;}'
    + '</style></head><body><div class="container">';
    messages.forEach((msg) => {
      // console.log(msg);

      const sender = msg.sender;
      const type = msg.type;
      var messagebody = "";

      if (msg["content"]) {
        if (msg.content.msgtype == 'm.image') {
          // images .. maybe later
        }
        else if (msg.content["formatted_body"]) {
          messagebody = msg.content.formatted_body;
        } else if (msg.content["body"]) {
          messagebody = htmlentities(msg.content.body);
        }

        if (messagebody) {
          const msgdate = new Date(msg.origin_server_ts);
          const month = msgdate.getMonth() + 1;
          const date = msgdate.getDate();
          const msgtime = date + '.' + month + '. ' + msgdate.toISOString().slice(-13,-8);
          RESPONSE_HTML += '<div class="msg ' + type + '"><span class="meta"><b>' + msgtime + '</b><i>' + sender + '</i></span><span class="content">' + messagebody  + '</span></div>' + "\n";
          console.log("processing message .. ", msg.event_id );
        } else {
          console.log("processing message .. ", msg.event_id, '=> skipping! unknown content.' );
        }
      } else {
        console.log("processing message .. ", msg.event_id, '=> skipping! no content.' );
      }
    });

    RESPONSE_HTML += '</div></body></html>';

    // console.log("RESPONSE", RESPONSE_HTML);
    console.log("Writing index.html");
    fs.writeFileSync("index.html", RESPONSE_HTML);

  } catch(err){
    console.error("ERROR", err);
  }
}

main();
