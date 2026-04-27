const { publishWhatsAppMessage } = require('../services/rabbitmqPublisher');
const {
  resolveChatId,
  resolvePhoneChatId,
  toPhoneNumber,
} = require('../services/chatIdResolver');

function registerMessageListener(client) {
  client.onMessage(async (message) => {
    try {
      const queueMessage = await toQueueMessageWithRealPhone(client, message);
      if (!queueMessage) {
        console.warn(`WhatsApp message ignored because no real phone number was resolved: from=${message?.from}`);
        return;
      }

      await publishWhatsAppMessage(queueMessage);

      console.log(queueMessage.from);
      if (queueMessage.fromMe) return;

      const autoReplyMessage = process.env.WHATSAPP_AUTO_REPLY_MESSAGE;
      if (!autoReplyMessage) return;

      const chatId = await resolveChatId(client, queueMessage.from);
      await client.sendText(chatId, autoReplyMessage);
    } catch (error) {
      console.error('Failed to process incoming WhatsApp message', error);
    }
  });
}

async function toQueueMessageWithRealPhone(client, message) {
  const fromChatId = await resolvePhoneChatId(client, message?.from);
  const toChatId = await resolvePhoneChatId(client, message?.to);
  const fromNumber = toPhoneNumber(fromChatId);
  const toNumber = toPhoneNumber(toChatId);

  if (!fromNumber || !toNumber) {
    return undefined;
  }

  return {
    ...message,
    from: fromNumber,
    to: toNumber,
    chatId: fromNumber,
  };
}

module.exports = { registerMessageListener };
