const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const path = require('path');
const { setLastQrData, registerQrRoute } = require('./routes/qrCode');
const { registerSendMessageRoute } = require('./routes/sendMessage');
const { registerMessageListener } = require('./listeners/messageListener');
const { registerSession, setSessionStatus, registerSessionsRoute } = require('./routes/sessions');

const sessionName = 'server-session';
const tokenFolder = path.resolve(__dirname, 'tokens');
const fileTokenStore = new wppconnect.tokenStore.FileTokenStore({
  path: tokenFolder,
});

wppconnect
  .create({
    session: sessionName,
    catchQR: (base64Qr, asciiQR, attempts, urlQR) => {
      setLastQrData({ base64Qr, asciiQR, attempts, urlQR });
    },
    folderNameToken: tokenFolder,
    tokenStore: fileTokenStore,
    autoClose: 0,
  })
  .then((client) => {
    registerSession(sessionName);
    setSessionStatus(sessionName, 'online');

    client.onStateChange((state) => {
      setSessionStatus(sessionName, state);
    });

    const app = express();
    app.use(express.json());

    registerSendMessageRoute(app, client);
    registerQrRoute(app);
    registerSessionsRoute(app);

    registerMessageListener(client);

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`wppconnect server listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Error initializing wppconnect', error);
  });
