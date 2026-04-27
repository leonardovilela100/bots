const { resolveChatId } = require('../services/chatIdResolver');

function registerSendMessageRoute(app, getClient) {
  app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    if (!number || !message) {
      return res.status(400).json({ error: 'number and message are required' });
    }
    try {
      const client = getClient();

      if (!client) {
        return res.status(503).json({ error: 'WhatsApp client is not connected yet' });
      }

      const chatId = await resolveChatId(client, number);
      await client.sendText(chatId, message);
      res.json({ status: 'sent', chatId });
    } catch (error) {
      console.error(`Failed to send WhatsApp message to ${number}`, error);
      res.status(500).json({
        error: error?.message || error?.toString?.() || 'Unknown error',
        number,
      });
    }
  });
}

module.exports = { registerSendMessageRoute };
