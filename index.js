const axios = require('axios');
const fs = require('fs');
const config = require('./config');

const date = new Date()
console.log("START .. script time:", new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString());

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

// Transform matrix username string to a color (Fallback for ppl without avatar)
// ref. https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors
// and https://stackoverflow.com/questions/11120840/hash-string-into-rgb-color
function djb2(str){
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  return hash;
}
function hashStringToColor(str) {
  var hash = djb2(str);
  var r = (hash & 0xFF0000) >> 16;
  var g = (hash & 0x00FF00) >> 8;
  var b = hash & 0x0000FF;
  // shade the color to black by 60%
  return RGB_Log_Shade(-0.6, `rgb(${r},${g},${b})`);
}
const RGB_Log_Shade=(p,c)=>{
  var i=parseInt,r=Math.round,[a,b,c,d]=c.split(","),P=p<0,t=P?0:p*255**2,P=P?1+p:1-p;
  return"rgb"+(d?"a(":"(")+r((P*i(a[3]=="a"?a.slice(5):a.slice(4))**2+t)**0.5)+","+r((P*i(b)**2+t)**0.5)+","+r((P*i(c)**2+t)**0.5)+(d?","+d:")");
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
async function getRoomMessages(roomId, accessToken) {
  const url = MATRIX_API_SERVER + `/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=25&access_token=${accessToken}`;

  const res = await axios.get(url);
  const { data } = await res;
  // console.log("messages response", data);
  return data.chunk
}

var avatarUrlCache = {};
async function getAvatarUrl(userId) {
  if (userId in avatarUrlCache) {
    return avatarUrlCache[userId];
  }
  const url = MATRIX_API_SERVER + '/profile/' + userId;
  const res = await axios.get(url);
  const { data } = await res;
  // console.log("userInfo response", data)
  if (!data.avatar_url) {
    avatarUrlCache[userId] = '';
    return '';
  }
  const avatar_url = config.generate_matrix_avatar_url(data.avatar_url.replace('mxc://', ''));
  console.log("avatar url", avatar_url);
  avatarUrlCache[userId] = avatar_url;
  return avatar_url;
}

function htmlentities(rawStr) {
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function(i) {
    return '&#'+i.charCodeAt(0)+';';
  });
}

async function getAvatarHtml(userId) {
  const avatarUrl = await getAvatarUrl(userId);
  if (avatarUrl) {
    return '<img src="' + avatarUrl + '" />'
  } else {
    const color = hashStringToColor(userId);
    return '<div class="avatar" style="background-color:' + color + '">' + userId.charAt(1).toUpperCase() + '</div>';
  }
}


async function main() {
  var messages = []
  try {
    // define the codeformünster-events channel name in the config
    const roomName = config.matrix_room_name;

    // if token is invalid, use the getMatrixApiToken() method to get a new one
    var token = config.matrix_api_token;
    if (!token) {
      token = await getMatrixApiToken();
    }

    const roomId = await getRoomId(roomName);
    messages = await getRoomMessages(roomId, token);
  } catch(err){
    console.error("ERROR during fetching of messages!!", err);
  }

  RESPONSE_HTML = '<html lang="de"><head><meta charset="utf-8"><title>CodeforMünster Events Matrix Channel</title>'
  + '<style>'
  + 'body {	font-family: Tahoma, Verdana, Segoe, sans-serif; font-size: 0.8em;}'
  + '.msg i {max-width:90px;overflow:hidden;white-space: nowrap; display:inline-block;background-color:#777;color:white;}'
  + 'body {overflow-y: hidden;margin: 0;}'
  + '.container div.msg, div.separator {margin: 1px 5px;background-color: #eee;border-radius: 10px; padding: 0 5px;}'
  + 'div.separator {background-color:#f14668;color:white;text-align:center;font-style:italic;letter-spacing: 2px;border-radius:0}'
  + 'div.msg.last {margin-top:6px}'
  + 'span.meta {float:left;display:block;border-radius:5px;background-color:#ccc;margin-right:5px}'
  + 'span.other {float:left;display:block;}'
  + 'b, i, span {display: inline;padding: 0}'
  + '.container {height: 100%;overflow: auto;display: flex;flex-direction: column-reverse;}'
  + '.header {height:20px;background-color:black;color:white;text-align:center}'
  + '.header a {color:white}'
  + '.header img {vertical-align:middle;}'
  + '.avatar, .msg img {width:35px;height:35px;float:left;margin-right:5px;font-size:26px;color:#ddd;text-align:center}'
  + '</style></head><body>'
  + '<div class="header"><img height="20" src="matrix-logo.png" /> <a target="_blank" href="https://matrix.to/#/#codeformuenster-events:matrix.org">#codeformuenster-events:matrix.org</a></div>'
  + '<div class="container"><div class="msg last">.</div>';
  var lastdatestring = "";
  for (let index = 0; index < messages.length; index++) {
    try {

      msg = messages[index];
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
          const utcdate = new Date(msg.origin_server_ts);
          // convert utc time to local time
          const msgdate = new Date(utcdate.getTime() - (utcdate.getTimezoneOffset() * 60000))
          const month = msgdate.getMonth() + 1;
          const date = msgdate.getDate();
          const dayname = msgdate.toLocaleDateString("de-DE", { weekday: 'long' });
          const datestring = date + '.' + month + '. ';
          const msgtime = datestring + msgdate.toISOString().slice(-13,-8);
          const avatarHtml = await getAvatarHtml(msg.user_id);
          if (lastdatestring != datestring) {
            if (lastdatestring) {
              RESPONSE_HTML += '<div class="separator">' + dayname + ', ' + lastdatestring +'</div>';
            }
            lastdatestring = datestring;
          }
          RESPONSE_HTML += '<div class="msg ' + type + '">'
          + '<span class="meta">'
          + avatarHtml
          + '<span class="other"><b>' + msgtime + '</b><br /><i>' + sender + '</i></span></span>'
          + '<span class="content">' + messagebody  + '</span></div>' + "\n";
          console.log("processing message .. ", msg.event_id );
        } else {
          console.log("processing message .. ", msg.event_id, '=> skipping! unknown content of type', type );
        }
      } else {
        console.log("processing message .. ", msg.event_id, '=> skipping! no content.' );
      }

    } catch(err){
      console.error("ERROR", err);
    }

  }

  RESPONSE_HTML += '</div></body></html>';

  // console.log("RESPONSE", RESPONSE_HTML);
  console.log("Writing index.html");
  fs.writeFileSync("public/index.html", RESPONSE_HTML);

}

main();
