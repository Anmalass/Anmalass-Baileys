export declare const unwrapMessage:
  (input: any) => any

export declare const getMessageType:
  (input: any) => string | null

export declare const detectMediaType:
  (input: any) => string | null

export declare const extractText:
  (input: any) => string

export declare const getContextInfo:
  (input: any) => any

export declare const extractQuotedMessage:
  (input: any) => any

export declare const parseProtocolMessage:
  (input: any) => any

export declare const parseMessageRevoke:
  (input: any) => any

export declare const parseEditedMessage:
  (input: any) => any

export declare const getParticipantJid:
  (input: any) => string | null

export declare const getMessageInfo:
  (input: any) => any

export declare const VENEXVORA_MESSAGE_FEATURES:
  Readonly<{
    unwrapEphemeral: true
    unwrapViewOnce: true
    quotedExtractor: true
    textExtractor: true
    mediaDetector: true
    revokeParser: true
    editedMessageParser: true
    protocolParser: true
  }>

export declare const getVenexvoraMessageType:
  (input: any) => string | null
