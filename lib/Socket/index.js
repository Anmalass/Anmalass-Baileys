import {
    DEFAULT_CONNECTION_CONFIG
} from '../Defaults/index.js'

import {
    makeCommunitiesSocket
} from './communities.js'

import {
    generateWAMessageFromContent
} from '../Utils/messages.js'

import {
    generateType6Buttons,
    generateType6List,
    generateType6Popup,
    generateVenexvoraButtons,
    generateCarouselV2,
    generateVenexvoraRichHtml
} from '../addons/venexvora-interactive.js'

/**
 * ============================================================
 * @venexvora/baileys
 * FINAL SOCKET LAYER
 * ============================================================
 */

const makeWASocket = config => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    }

    const sock =
        makeCommunitiesSocket(
            newConfig
        )

    /**
     * Relay a raw proto message reliably.
     *
     * Useful for:
     * - ButtonsMessage
     * - InteractiveMessage
     * - NativeFlow
     * - Carousel
     * - RichResponse
     */
    sock.sendVenexvoraRaw = async (
        jid,
        content,
        options = {}
    ) => {
        const {
            relayOptions = {},
            ...generationOptions
        } = options || {}

        const generated =
            generateWAMessageFromContent(
                jid,
                content,
                {
                    userJid:
                        sock.user?.id,

                    ...generationOptions
                }
            )

        await sock.relayMessage(
            jid,
            generated.message,
            {
                messageId:
                    generated.key.id,

                ...relayOptions
            }
        )

        return generated
    }

    /**
     * Classic Type 6 buttons.
     */
    sock.sendType6Buttons = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateType6Buttons(
                options
            ),
            sendOptions
        )
    }

    /**
     * Type 6 + NativeFlow single_select.
     */
    sock.sendType6List = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateType6List(
                options
            ),
            sendOptions
        )
    }

    /**
     * Official Venexvora Type 6 popup.
     *
     * One full-width button opens popup list.
     */
    sock.sendType6Popup = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateType6Popup(
                options
            ),
            sendOptions
        )
    }

    /**
     * Universal NativeFlow buttons.
     */
    sock.sendVenexvoraButtons = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateVenexvoraButtons(
                options
            ),
            sendOptions
        )
    }

    /**
     * Interactive Carousel.
     */
    sock.sendCarouselV2 = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateCarouselV2(
                options
            ),
            sendOptions
        )
    }

    /**
     * Rich HTML / unifiedResponse.
     */
    sock.sendVenexvoraRichHtml = async (
        jid,
        options,
        sendOptions = {}
    ) => {
        return sock.sendVenexvoraRaw(
            jid,
            generateVenexvoraRichHtml(
                options
            ),
            sendOptions
        )
    }

    /**
     * Short alias.
     */
    sock.sendRichHtml =
        sock.sendVenexvoraRichHtml

    return sock
}

export default makeWASocket
