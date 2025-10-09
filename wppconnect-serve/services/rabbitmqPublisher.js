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

async function createChannel() {
  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName, { durable: true });
  return channel;
}

async function getChannel() {
  if (!channelPromise) {
    channelPromise = createChannel().catch((error) => {
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
  }
}

module.exports = {
  publishWhatsAppMessage,
};
