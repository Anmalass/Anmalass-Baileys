/**
 * @venexvora/baileys
 * VENEXVORA Fork Message Utilities
 */

const WRAPPER_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension'
]

export const unwrapMessage = input => {
  let message =
    input?.message ??
    input ??
    null

  let depth = 0

  while (
    message &&
    depth < 10
  ) {
    let unwrapped = false

    for (
      const key of
      WRAPPER_KEYS
    ) {
      if (
        message?.[key]?.message
      ) {
        message =
          message[key].message

        unwrapped = true
        depth++
        break
      }
    }

    if (!unwrapped) {
      break
    }
  }

  return message
}

export const getMessageType = input => {
  const message =
    unwrapMessage(input)

  if (
    !message ||
    typeof message !== 'object'
  ) {
    return null
  }

  return (
    Object.keys(message)
      .find(key => {
        const value =
          message[key]

        return (
          value !== undefined &&
          value !== null
        )
      }) ??
    null
  )
}

export const detectMediaType = input => {
  const message =
    unwrapMessage(input)

  if (!message) {
    return null
  }

  if (message.imageMessage) {
    return 'image'
  }

  if (message.videoMessage) {
    return 'video'
  }

  if (message.audioMessage) {
    return 'audio'
  }

  if (message.stickerMessage) {
    return 'sticker'
  }

  if (message.documentMessage) {
    return 'document'
  }

  if (message.contactMessage) {
    return 'contact'
  }

  if (
    message.contactsArrayMessage
  ) {
    return 'contacts'
  }

  if (message.locationMessage) {
    return 'location'
  }

  if (
    message.liveLocationMessage
  ) {
    return 'live-location'
  }

  return null
}

export const extractText = input => {
  const message =
    unwrapMessage(input)

  if (!message) {
    return ''
  }

  return (
    message.conversation ??
    message.extendedTextMessage
      ?.text ??
    message.imageMessage
      ?.caption ??
    message.videoMessage
      ?.caption ??
    message.documentMessage
      ?.caption ??
    message.buttonsResponseMessage
      ?.selectedDisplayText ??
    message.listResponseMessage
      ?.title ??
    message.templateButtonReplyMessage
      ?.selectedDisplayText ??
    message.interactiveResponseMessage
      ?.body?.text ??
    ''
  )
}

export const getContextInfo = input => {
  const message =
    unwrapMessage(input)

  if (!message) {
    return null
  }

  for (
    const value of
    Object.values(message)
  ) {
    if (
      value &&
      typeof value === 'object' &&
      value.contextInfo
    ) {
      return value.contextInfo
    }
  }

  return null
}

export const extractQuotedMessage = input => {
  const context =
    getContextInfo(input)

  if (
    !context?.quotedMessage
  ) {
    return null
  }

  const message =
    unwrapMessage(
      context.quotedMessage
    )

  return {
    stanzaId:
      context.stanzaId ??
      null,

    participant:
      context.participant ??
      null,

    remoteJid:
      context.remoteJid ??
      null,

    message,

    type:
      getMessageType(message),

    mediaType:
      detectMediaType(message),

    text:
      extractText(message),

    contextInfo:
      context
  }
}

export const parseProtocolMessage = input => {
  const message =
    unwrapMessage(input)

  const protocol =
    message?.protocolMessage

  if (!protocol) {
    return null
  }

  return {
    type:
      protocol.type,

    key:
      protocol.key ??
      null,

    editedMessage:
      protocol.editedMessage ??
      null,

    timestampMs:
      protocol.timestampMs ??
      null,

    raw:
      protocol
  }
}

export const parseMessageRevoke = input => {
  const protocol =
    parseProtocolMessage(input)

  if (!protocol) {
    return null
  }

  /*
   * WhatsApp protocol values can differ
   * between generated versions.
   * Revoke is detected primarily by key
   * existence + absence of editedMessage.
   */
  if (
    !protocol.key ||
    protocol.editedMessage
  ) {
    return null
  }

  return {
    key:
      protocol.key,

    remoteJid:
      protocol.key.remoteJid ??
      null,

    fromMe:
      Boolean(
        protocol.key.fromMe
      ),

    id:
      protocol.key.id ??
      null,

    participant:
      protocol.key.participant ??
      null,

    protocolType:
      protocol.type,

    raw:
      protocol.raw
  }
}

export const parseEditedMessage = input => {
  const protocol =
    parseProtocolMessage(input)

  if (
    !protocol?.editedMessage
  ) {
    return null
  }

  const message =
    unwrapMessage(
      protocol.editedMessage
    )

  return {
    key:
      protocol.key ??
      null,

    message,

    type:
      getMessageType(message),

    mediaType:
      detectMediaType(message),

    text:
      extractText(message),

    protocolType:
      protocol.type,

    raw:
      protocol.raw
  }
}

export const getParticipantJid = input => {
  return (
    input?.key?.participant ??
    input?.participant ??
    input?.key?.remoteJid ??
    null
  )
}

export const getMessageInfo = input => {
  const message =
    unwrapMessage(input)

  const quoted =
    extractQuotedMessage(input)

  return {
    key:
      input?.key ??
      null,

    jid:
      input?.key?.remoteJid ??
      null,

    participant:
      getParticipantJid(input),

    type:
      getMessageType(message),

    mediaType:
      detectMediaType(message),

    text:
      extractText(message),

    message,

    quoted,

    revoke:
      parseMessageRevoke(input),

    edited:
      parseEditedMessage(input)
  }
}

export const VENEXVORA_MESSAGE_FEATURES =
  Object.freeze({
    unwrapEphemeral: true,
    unwrapViewOnce: true,
    quotedExtractor: true,
    textExtractor: true,
    mediaDetector: true,
    revokeParser: true,
    editedMessageParser: true,
    protocolParser: true
  })

/**
 * Explicit Venexvora alias.
 * Avoids export collision with the original Baileys getMessageType().
 */
export const getVenexvoraMessageType = getMessageType
