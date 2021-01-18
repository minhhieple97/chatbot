// require("dotenv").config();
"use strict";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
// Imports dependencies and set up http server
const request = require("request"),
  express = require("express"),
  path = require("path"),
  app = express().use(express.json()); // creates express http server
app.set("views", path.join(__dirname, "./views"));
app.set("view engine", "ejs");
// Sets server port and logs message on success
app.listen(process.env.PORT || 3001, () => console.log("webhook is listening"));

// Accepts POST requests at /webhook endpoint
app.post("/webhook", (req, res) => {
  // Parse the request body from the POST
  let body = req.body;
  console.log("body", JSON.stringify(req.body));
  // Check the webhook event is from a Page subscription
  if (body.object === "page") {
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];

      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      // console.log('Sender ID: ' + sender_psid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
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
  console.log(req.query);
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
  return res.render("hotel.ejs");
});
app.post("/set-up-webview", (req, res) => {
  console.log(req.body);
  return res.redirect("/");
});
function handleMessage(sender_psid, received_message) {
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
        image_url: "https://image.flaticon.com/teams/slug/freepik.jpg",
        buttons: [
          {
            type: "web_url",
            url: process.env.WEBVIEW_URL,
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
  callSendAPI(sender_psid, response);
}

function handlePostback(sender_psid, received_postback) {
  console.log("ok");
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

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    recipient: {
      id: sender_psid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  console.log({ request_body: JSON.stringify(request_body) });
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: request_body,
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}
