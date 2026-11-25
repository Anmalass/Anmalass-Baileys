import { proto } from '../../WAProto/index.js'
import {
    generateWAMessageFromContent
} from '../Utils/messages.js'

const asString = (
    value,
    fallback = ''
) => {
    if (
        value === undefined ||
        value === null
    ) {
        return fallback
    }

    return String(value)
}

const asBuffer = value => {
    if (
        Buffer.isBuffer(value)
    ) {
        return value
    }

    if (
        value instanceof Uint8Array
    ) {
        return Buffer.from(value)
    }

    return null
}

/**
 * VENEXVORA Fork Button V2
 *
 * Safe internal builder inspired by the API style:
 *
 * const btn = new VenexvoraButtonV2(sock)
 * btn.setBody(...)
 * btn.setFooter(...)
 * btn.setThumbnail(...)
 * btn.addRawButton(...)
 * await btn.send(jid)
 *
 * No baileys-mbuilder dependency.
 */
export class VenexvoraButtonV2 {
    constructor(
        sock,
        options = {}
    ) {
        if (!sock) {
            throw new Error(
                'VENEXVORA Fork: socket is required'
            )
        }

        this.sock =
            sock

        this.body =
            ''

        this.footer =
            ''

        this.thumbnail =
            null

        this.title =
            ''

        this.address =
            ''

        this.buttons =
            []

        this.quoted =
            options?.quoted

        this.latitude =
            Number(
                options?.latitude ??
                0
            )

        this.longitude =
            Number(
                options?.longitude ??
                0
            )
    }

    setBody(text = '') {
        this.body =
            asString(text)

        return this
    }

    setFooter(text = '') {
        this.footer =
            asString(text)

        return this
    }

    setThumbnail(buffer) {
        const thumb =
            asBuffer(buffer)

        if (!thumb) {
            throw new Error(
                'VENEXVORA Fork: thumbnail must be Buffer or Uint8Array'
            )
        }

        this.thumbnail =
            thumb

        return this
    }

    setTitle(text = '') {
        this.title =
            asString(text)

        return this
    }

    setAddress(text = '') {
        this.address =
            asString(text)

        return this
    }

    setQuoted(message) {
        this.quoted =
            message

        return this
    }

    addRawButton(button = {}) {
        if (
            !button ||
            typeof button !== 'object'
        ) {
            throw new Error(
                'VENEXVORA Fork: invalid raw button'
            )
        }

        const normalized = {
            buttonId:
                asString(
                    button?.buttonId,
                    `venexvora-v2-${this.buttons.length + 1}`
                ),

            buttonText: {
                displayText:
                    asString(
                        button?.buttonText?.displayText,
                        button?.displayText ??
                        'BUTTON'
                    )
            },

            type:
                Number(
                    button?.type ??
                    1
                )
        }

        /*
         * Preserve NativeFlow data exactly.
         * Important for single_select compatibility testing.
         */
        if (
            button?.nativeFlowInfo
        ) {
            normalized.nativeFlowInfo = {
                name:
                    asString(
                        button
                            .nativeFlowInfo
                            ?.name
                    ),

                paramsJson:
                    asString(
                        button
                            .nativeFlowInfo
                            ?.paramsJson,
                        '{}'
                    )
            }
        }

        this.buttons.push(
            normalized
        )

        return this
    }

    addSingleSelect(
        displayText,
        {
            title = 'Pilih Menu',
            sections = [],
            buttonId = 'venexvora-single-select'
        } = {}
    ) {
        return this.addRawButton({
            buttonId,

            buttonText: {
                displayText:
                    asString(
                        displayText,
                        'PILIH MENU'
                    )
            },

            type: 1,

            nativeFlowInfo: {
                name:
                    'single_select',

                paramsJson:
                    JSON.stringify({
                        title,
                        sections
                    })
            }
        })
    }

    build() {
        if (
            !this.body
        ) {
            throw new Error(
                'VENEXVORA Fork: body is required'
            )
        }

        if (
            !this.buttons.length
        ) {
            throw new Error(
                'VENEXVORA Fork: at least one button is required'
            )
        }

        const locationMessage = {
            degreesLatitude:
                this.latitude,

            degreesLongitude:
                this.longitude
        }

        if (
            this.thumbnail
        ) {
            locationMessage.jpegThumbnail =
                this.thumbnail
        }

        if (
            this.title
        ) {
            locationMessage.name =
                this.title
        }

        if (
            this.address
        ) {
            locationMessage.address =
                this.address
        }

        return {
            buttonsMessage:
                proto.Message.ButtonsMessage.create({
                    buttons:
                        this.buttons,

                    locationMessage,

                    contentText:
                        this.body,

                    footerText:
                        this.footer,

                    headerType:
                        6
                })
        }
    }

    async send(
        jid,
        options = {}
    ) {
        if (!jid) {
            throw new Error(
                'VENEXVORA Fork: jid is required'
            )
        }

        const content =
            this.build()

        const generated =
            generateWAMessageFromContent(
                jid,
                content,
                {
                    userJid:
                        this.sock
                            ?.user
                            ?.id,

                    quoted:
                        options?.quoted ??
                        this.quoted
                }
            )

        await this.sock.relayMessage(
            jid,
            generated.message,
            {
                messageId:
                    generated.key.id,

                ...(
                    options?.relayOptions ||
                    {}
                )
            }
        )

        return generated
    }
}

export const ButtonV2 =
    VenexvoraButtonV2

export const createVenexvoraButtonV2 = (
    sock,
    options = {}
) =>
    new VenexvoraButtonV2(
        sock,
        options
    )

export const VENEXVORA_BUTTON_V2_FEATURES = {
    type6: true,
    rawButtons: true,
    singleSelectPayload: true,
    localThumbnail: true,
    rawProtoRelay: true,
    externalBuilderDependency: false
}
