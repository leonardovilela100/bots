function registerMessageListener(client) {
  client.onMessage((message) => {
    console.log('Received message:', message);
  });
}

module.exports = { registerMessageListener };
