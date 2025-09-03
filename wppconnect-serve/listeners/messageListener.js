function registerMessageListener(client) {
  client.onMessage((message) => {
  });

  client.onMessage(async (message) => {
    console.log(message.from)
    if (message.fromMe) return;
    await client.sendText(message.from, 'Eu sou o atendente inteligente da Cliente Já, como posso te ajudar?');
  });

}

module.exports = { registerMessageListener };
