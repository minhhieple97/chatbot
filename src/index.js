// require("dotenv").config();
"use strict";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const { default: axios } = require("axios");
const base64url = require('base64url');
const crypto = require('crypto')
const bodyParser = require("body-parser");
// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  path = require("path"),
  app = express().use(express.json()); // creates express http server
app.use(bodyParser.urlencoded({
  extended: true
}));
app.set("views", path.join(__dirname, "./views"));
app.set("view engine", "ejs");
// Sets server port and logs message on success
app.listen(process.env.PORT || 3001, () => console.log("webhook is listening"));

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;
  console.log(JSON.stringify(body))
  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    body.entry.forEach(async function (entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      // console.log('Sender ID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        await handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        console.log("POST BACK", webhook_event.postback);
        handlePostback(sender_psid, webhook_event.postback);
      }
    });
    // Return a '200 OK' response to all events
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Accepts GET requests at the /webhook endpoint
app.get("/webhook_", (req, res) => {
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "pusher-bot";
  // Parse params from the webhook verification request
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      console.log({ challenge });
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});
app.get("/webview", (req, res) => {
  console.log(req.query)
  return res.render("hotel.ejs", { psid: req.query.userId });
});
app.post("/set-up-webview", (req, res) => {
  console.log(req.body);
  return res.status(200).json({ message: "OK" });
});
async function handleMessage(sender_psid, received_message) {
  let response;

  // Checks if the message contains text
  //   if (received_message.text) {
  //     // Create the payload for a basic text message, which
  //     // will be added to the body of our request to the Send API
  //     response = {
  //       text: `You sent the message: "${received_message.text}". Now send me an attachment!`,
  //     };
  //   } else if (received_message.attachments) {
  // Get the URL of the message attachment
  //   let attachment_url = received_message.attachments[0].payload.url;
  response = {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text:
          "OK. Let's set your room preferences, so I won't ? need to ask for them in the future?",
        buttons: [
          {
            type: "web_url",
            url: `${process.env.WEBVIEW_URL}?userId=123412345234`,
            title: "Set preferences",
            webview_height_ratio: "tall", //display on mobile
            messenger_extensions: true, //false : open the webview in new tab
          },
        ],
      },
    },
  };
  //   }

  // Send the response message
  await callSendAPI(sender_psid, response);
}

async function handlePostback(sender_psid, received_postback) {
  let response;
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === "yes") {
    response = { text: "Thanks!" };
  } else if (payload === "no") {
    response = { text: "Oops, try sending another image." };
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}

const callSendAPI = async (sid, content) => {
  try {
    // Construct the message body
    let request_body = {
      recipient: {
        id: sid,
      },
      message: content,
    };
    const json = JSON.stringify(request_body);
    const response = await axios.post(
      `https://graph.facebook.com/v9.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`,
      json,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data)
    return response.data;
  } catch (error) {
    console.log(error.message);
  }
};


// function parse_signed_request(signed_request, secret) {
//   let encoded_data = signed_request.split('.', 2);
//   // decode the data
//   let sig = encoded_data[0];
//   let json = base64url.decode(encoded_data[1]);
//   let data = JSON.parse(json); // ERROR Occurs Here!

//   // check algorithm - not relevant to error
//   if (!data.algorithm || data.algorithm.toUpperCase() != 'HMAC-SHA256') {
//     console.error('Unknown algorithm. Expected HMAC-SHA256');
//     return null;
//   }

//   // check sig - not relevant to error
//   let expected_sig = crypto.createHmac('sha256', secret).update(encoded_data[1]).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace('=', '');
//   if (sig !== expected_sig) {
//     console.error('Bad signed JSON Signature!');
//     return null;
//   }
//   console.log({ data })
//   return data;
// }
// parse_signed_request("Ss4TLO912sQqGxTd6eUSuuhVAmkaAd0VHWdRAmXtpJI.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvbW11bml0eV9pZCI6bnVsbCwiaXNzdWVkX2F0IjoxNjExMDQwNzY4LCJtZXRhZGF0YSI6bnVsbCwicGFnZV9pZCI6MzM3NTUwMzU5OTU3OTY0LCJwc2lkIjoiIiwidGhyZWFkX3BhcnRpY2lwYW50X2lkcyI6bnVsbCwidGhyZWFkX3R5cGUiOiJVU0VSX1RPX1BBR0UiLCJ0aWQiOiIifQ", "35c0e2843384abcdb1895016400e0ec5")