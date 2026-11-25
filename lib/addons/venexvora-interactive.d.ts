export type VenexvoraRow = {
  id?: string
  rowId?: string
  title: string
  description?: string
  header?: string
}

export type VenexvoraSection = {
  title?: string
  highlightLabel?: string
  highlight_label?: string
  rows: VenexvoraRow[]
}

export type VenexvoraClassicButton = {
  id?: string
  buttonId?: string
  text?: string
  displayText?: string
}

export type VenexvoraNativeButton =
  | {
      type: 'reply' | 'quick_reply'
      id: string
      text?: string
      displayText?: string
    }
  | {
      type: 'url' | 'cta_url'
      url: string
      merchantUrl?: string
      text?: string
      displayText?: string
    }
  | {
      type: 'copy' | 'cta_copy'
      value?: string
      copyCode?: string
      text?: string
      displayText?: string
    }
  | {
      type: 'call' | 'cta_call'
      phoneNumber: string
      text?: string
      displayText?: string
    }
  | {
      type: 'list' | 'single_select'
      title?: string
      text?: string
      sections: VenexvoraSection[]
    }

export declare const buildSingleSelectParams:
  (options: {
    title?: string
    sections: VenexvoraSection[]
  }) => string

export declare const generateType6Buttons:
  (options: {
    text?: string
    body?: string
    footer?: string
    jpegThumbnail?: Uint8Array
    thumbnail?: Uint8Array
    latitude?: number
    longitude?: number
    buttons?: VenexvoraClassicButton[]
  }) => {
    buttonsMessage: any
  }

export declare const generateType6List:
  (options: {
    text?: string
    body?: string
    footer?: string
    title?: string
    listTitle?: string
    buttonText?: string
    buttonId?: string
    sections: VenexvoraSection[]
    jpegThumbnail?: Uint8Array
    thumbnail?: Uint8Array
    latitude?: number
    longitude?: number
  }) => {
    buttonsMessage: any
  }

export declare const generateSingleSelect:
  (options: {
    text?: string
    body?: string
    footer?: string
    title?: string
    sections: VenexvoraSection[]
    header?: {
      title?: string
      subtitle?: string
      hasMediaAttachment?: boolean
    }
    messageParamsJson?: string
  }) => {
    interactiveMessage: any
  }

export declare const generateVenexvoraButtons:
  (options: {
    text?: string
    body?: string
    footer?: string
    buttons: VenexvoraNativeButton[]
    header?: {
      title?: string
      subtitle?: string
      hasMediaAttachment?: boolean
    }
    messageParamsJson?: string
  }) => {
    interactiveMessage: any
  }

export declare const generateQuickReplyV2:
  (
    text: string,
    buttons: any[],
    options?: any
  ) => {
    interactiveMessage: any
  }

export declare const generateUrlButtonsV2:
  (
    text: string,
    buttons: any[],
    options?: any
  ) => {
    interactiveMessage: any
  }

export declare const generateCopyButtonV2:
  (
    text: string,
    value: string,
    buttonText?: string,
    options?: any
  ) => {
    interactiveMessage: any
  }

export declare const generateCallButtonV2:
  (
    text: string,
    phoneNumber: string,
    buttonText?: string,
    options?: any
  ) => {
    interactiveMessage: any
  }

export declare const VENEXVORA_INTERACTIVE_FEATURES:
  Readonly<{
    type6: true
    type6Buttons: true
    type6SingleSelect: true
    type6Popup: true
    nativeFlow: true
    quickReply: true
    urlButton: true
    copyButton: true
    callButton: true
    singleSelect: true
    carouselProto: true
    carouselV2: true
    richHtml: true
    richResponseProto: true
  }>

/**
 * Type 6 thumbnail + one full-width popup button.
 */
export declare const generateType6Popup:
  (options: {
    text?: string
    body?: string
    footer?: string

    title?: string
    listTitle?: string

    buttonText?: string
    buttonId?: string

    sections: VenexvoraSection[]

    jpegThumbnail?: Uint8Array
    thumbnail?: Uint8Array

    latitude?: number
    longitude?: number
  }) => {
    buttonsMessage: any
  }

export type VenexvoraCarouselCard = {
  text?: string
  body?: string
  footer?: string

  header?: {
    title?: string
    subtitle?: string
    hasMediaAttachment?: boolean
    [key: string]: any
  }

  buttons?: VenexvoraNativeButton[]
}

export declare const generateCarouselV2:
  (options: {
    text?: string
    body?: string
    footer?: string

    header?: {
      title?: string
      subtitle?: string
      hasMediaAttachment?: boolean
      [key: string]: any
    }

    messageVersion?: number
    cards: VenexvoraCarouselCard[]
  }) => {
    interactiveMessage: any
  }

export declare const generateVenexvoraRichHtml:
  (options: {
    html: string
  }) => {
    botForwardedMessage: any
  }

export declare const generateRichHtml:
  typeof generateVenexvoraRichHtml
