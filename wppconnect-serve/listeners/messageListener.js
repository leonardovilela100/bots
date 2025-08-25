function registerMessageListener(client) {
  client.onMessage((message) => {
    console.log('Received message:', message);
  });
/*
  client.onMessage(async (message) => {
    if (message.fromMe) return;
    await client.sendText(message.from, 'Eu sou Leonardo, como posso te ajudar?');
  });
  */
}

module.exports = { registerMessageListener };
