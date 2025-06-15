const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

// Initialize WhatsApp connection and then start the REST server
wppconnect
  .create({
    session: 'server-session',
  })
  .then((client) => {
    const app = express();
    app.use(express.json());

    // Endpoint to send text messages via POST
    app.post('/send-message', async (req, res) => {
      const { number, message } = req.body;
      if (!number || !message) {
        return res.status(400).json({ error: 'number and message are required' });
      }

      try {
        await client.sendText(`${number}@c.us`, message);
        res.json({ status: 'sent' });
      } catch (error) {
        res.status(500).json({ error: error.toString() });
      }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`wppconnect server listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Error initializing wppconnect', error);
  });
