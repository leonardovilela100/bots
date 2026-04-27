async function resolveChatId(client, number) {
  const normalizedInput = normalizeChatId(number);

  if (!client || typeof normalizedInput !== 'string') {
    return normalizedInput;
  }

  if (!isLidChatId(normalizedInput)) {
    return normalizedInput;
  }

  const phoneChatId = await resolvePhoneChatId(client, normalizedInput);
  if (phoneChatId) {
    return phoneChatId;
  }

  throw new Error(`Unable to resolve WhatsApp LID to a real phone number: ${normalizedInput}`);
}

async function resolvePhoneChatId(client, number) {
  const normalizedInput = normalizeChatId(number);

  if (typeof normalizedInput !== 'string') {
    return undefined;
  }

  if (!isLidChatId(normalizedInput)) {
    return normalizedInput;
  }

  try {
    const pnLidEntry = await client.getPnLidEntry(normalizedInput);
    const phoneChatId = pnLidEntry?.phoneNumber?._serialized;

    if (phoneChatId) {
      return phoneChatId;
    }
  } catch (error) {
    console.warn(`Failed to resolve LID ${normalizedInput} to phone number`, error);
  }

  return undefined;
}

function normalizeChatId(number) {
  if (typeof number !== 'string') {
    return number;
  }

  const trimmedNumber = number.trim();
  if (trimmedNumber.includes('@')) {
    return trimmedNumber;
  }

  return `${trimmedNumber}@c.us`;
}

function toPhoneNumber(chatId) {
  if (typeof chatId !== 'string') {
    return undefined;
  }

  const trimmedChatId = chatId.trim();
  if (!trimmedChatId || isLidChatId(trimmedChatId)) {
    return undefined;
  }

  if (trimmedChatId.includes('@') && !trimmedChatId.toLowerCase().endsWith('@c.us')) {
    return undefined;
  }

  const phoneNumber = trimmedChatId.split('@')[0].replace(/\D/g, '');
  return phoneNumber || undefined;
}

function isLidChatId(chatId) {
  return typeof chatId === 'string' && chatId.trim().toLowerCase().endsWith('@lid');
}

module.exports = {
  isLidChatId,
  normalizeChatId,
  resolvePhoneChatId,
  resolveChatId,
  toPhoneNumber,
};
