const amqp = require('amqplib');

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = '5672';
const DEFAULT_USERNAME = 'guest';
const DEFAULT_PASSWORD = 'guest';
const DEFAULT_QUEUE = 'whatsapp.messages';

const rabbitUrl =
  process.env.RABBITMQ_URL ||
  `amqp://${process.env.RABBITMQ_USERNAME || DEFAULT_USERNAME}:${process.env.RABBITMQ_PASSWORD || DEFAULT_PASSWORD}@${process.env.RABBITMQ_HOST || DEFAULT_HOST}:${process.env.RABBITMQ_PORT || DEFAULT_PORT}`;

const queueName = process.env.RABBITMQ_WHATSAPP_QUEUE || DEFAULT_QUEUE;

let channelPromise;
let activeChannel;

function registerChannelTeardown(channel, connection) {
  const resetChannelPromise = () => {
    if (activeChannel !== channel) {
      return;
    }

    activeChannel = undefined;
    channelPromise = undefined;

    try {
      connection.close().catch(() => {});
    } catch (closeError) {
      // Connection may already be closed or closing; ignore errors here.
    }
  };

  connection.once('close', resetChannelPromise);
  connection.once('error', resetChannelPromise);
  channel.once('close', resetChannelPromise);
  channel.once('error', resetChannelPromise);
}

async function createChannel() {
  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  activeChannel = channel;
  registerChannelTeardown(channel, connection);
  return channel;
}

async function getChannel() {
  if (!channelPromise) {
    channelPromise = createChannel().catch((error) => {
      activeChannel = undefined;
      channelPromise = undefined;
      throw error;
    });
  }
  return channelPromise;
}

async function publishWhatsAppMessage(message) {
  try {
    const channel = await getChannel();
    const payload = Buffer.from(JSON.stringify(message));
    const sent = channel.sendToQueue(queueName, payload, { persistent: true });

    if (!sent) {
      console.warn('RabbitMQ sendToQueue returned false for WhatsApp message');
    }
  } catch (error) {
    console.error('Failed to publish WhatsApp message to RabbitMQ', error);
    activeChannel = undefined;
    channelPromise = undefined;
  }
}

module.exports = {
  publishWhatsAppMessage,
};
