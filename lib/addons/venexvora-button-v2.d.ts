export type VenexvoraButtonV2RawButton = {
  buttonId?: string
  buttonText?: {
    displayText?: string
  }
  displayText?: string
  type?: number
  nativeFlowInfo?: {
    name?: string
    paramsJson?: string
  }
}

export type VenexvoraButtonV2SectionRow = {
  id: string
  title: string
  description?: string
  header?: string
}

export type VenexvoraButtonV2Section = {
  title?: string
  highlight_label?: string
  rows: VenexvoraButtonV2SectionRow[]
}

export declare class VenexvoraButtonV2 {
  constructor(
    sock: any,
    options?: {
      quoted?: any
      latitude?: number
      longitude?: number
    }
  )

  setBody(
    text?: string
  ): this

  setFooter(
    text?: string
  ): this

  setThumbnail(
    buffer:
      | Buffer
      | Uint8Array
  ): this

  setTitle(
    text?: string
  ): this

  setAddress(
    text?: string
  ): this

  setQuoted(
    message: any
  ): this

  addRawButton(
    button:
      VenexvoraButtonV2RawButton
  ): this

  addSingleSelect(
    displayText: string,
    options?: {
      title?: string
      sections?: VenexvoraButtonV2Section[]
      buttonId?: string
    }
  ): this

  build(): any

  send(
    jid: string,
    options?: {
      quoted?: any
      relayOptions?: Record<
        string,
        any
      >
    }
  ): Promise<any>
}

export declare const ButtonV2:
  typeof VenexvoraButtonV2

export declare const createVenexvoraButtonV2:
  (
    sock: any,
    options?: any
  ) => VenexvoraButtonV2

export declare const VENEXVORA_BUTTON_V2_FEATURES: {
  type6: boolean
  rawButtons: boolean
  singleSelectPayload: boolean
  localThumbnail: boolean
  rawProtoRelay: boolean
  externalBuilderDependency: boolean
}
