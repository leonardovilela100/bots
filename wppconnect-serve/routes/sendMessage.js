function registerSendMessageRoute(app, client) {
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
}

module.exports = { registerSendMessageRoute };
