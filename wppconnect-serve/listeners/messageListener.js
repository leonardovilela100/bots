const { publishWhatsAppMessage } = require('../services/rabbitmqPublisher');

function registerMessageListener(client) {
  client.onMessage(async (message) => {
    await publishWhatsAppMessage(message);

    console.log(message.from);
    if (message.fromMe) return;
    await client.sendText(
      message.from,
      'Eu sou o atendente inteligente da Cliente Já, como posso te ajudar?'
    );
  });
}

module.exports = { registerMessageListener };
