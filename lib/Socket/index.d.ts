import type {
  SocketConfig,
  WAMessage
} from '../Types/index.js'

import {
  makeCommunitiesSocket
} from './communities.js'

import type {
  VenexvoraClassicButton,
  VenexvoraNativeButton,
  VenexvoraSection,
  VenexvoraCarouselCard
} from '../addons/venexvora-interactive.js'

export type VenexvoraType6Options = {
  text?: string
  body?: string
  footer?: string

  jpegThumbnail?: Uint8Array
  thumbnail?: Uint8Array

  latitude?: number
  longitude?: number

  buttons?: VenexvoraClassicButton[]
}

export type VenexvoraType6PopupOptions = {
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
}

export type VenexvoraButtonsOptions = {
  text?: string
  body?: string
  footer?: string

  buttons: VenexvoraNativeButton[]

  header?: {
    title?: string
    subtitle?: string
    hasMediaAttachment?: boolean
    [key: string]: any
  }

  messageParamsJson?: string
}

export type VenexvoraCarouselOptions = {
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
}

export type VenexvoraRawSendOptions = {
  relayOptions?: Record<string, any>
  [key: string]: any
}

export type VenexvoraSocketHelpers = {
  sendVenexvoraRaw:
    (
      jid: string,
      content: any,
      options?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendType6Buttons:
    (
      jid: string,
      options: VenexvoraType6Options,
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendType6List:
    (
      jid: string,
      options: VenexvoraType6PopupOptions,
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendType6Popup:
    (
      jid: string,
      options: VenexvoraType6PopupOptions,
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendVenexvoraButtons:
    (
      jid: string,
      options: VenexvoraButtonsOptions,
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendCarouselV2:
    (
      jid: string,
      options: VenexvoraCarouselOptions,
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendVenexvoraRichHtml:
    (
      jid: string,
      options: {
        html: string
      },
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>

  sendRichHtml:
    (
      jid: string,
      options: {
        html: string
      },
      sendOptions?: VenexvoraRawSendOptions
    ) => Promise<WAMessage>
}

declare const makeWASocket:
  (
    config: SocketConfig
  ) =>
    ReturnType<
      typeof makeCommunitiesSocket
    > &
    VenexvoraSocketHelpers

export default makeWASocket
