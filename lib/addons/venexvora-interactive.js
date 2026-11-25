import { proto } from '../../WAProto/index.js'

/**
 * @venexvora/baileys
 * VENEXVORA Fork Interactive Helpers
 *
 * Features:
 * - Type 6 classic buttons
 * - Type 6 + NativeFlow popup list
 * - NativeFlow single_select
 * - NativeFlow quick_reply
 * - NativeFlow URL
 * - NativeFlow copy
 * - NativeFlow call
 * - Universal button builder
 */

const ensureString = (value, fallback = '') =>
  typeof value === 'string' ? value : fallback

const ensureArray = value =>
  Array.isArray(value) ? value : []

const cleanSections = sections =>
  ensureArray(sections)
    .map((section, sectionIndex) => ({
      title:
        ensureString(
          section?.title,
          `Section ${sectionIndex + 1}`
        ),
      highlight_label:
        ensureString(
          section?.highlightLabel ??
          section?.highlight_label
        ),
      rows:
        ensureArray(section?.rows)
          .map((row, rowIndex) => ({
            id:
              ensureString(
                row?.id ??
                row?.rowId,
                `row-${sectionIndex}-${rowIndex}`
              ),
            title:
              ensureString(
                row?.title,
                `Option ${rowIndex + 1}`
              ),
            description:
              ensureString(
                row?.description
              ),
            header:
              ensureString(
                row?.header
              )
          }))
          .filter(row => row.title)
    }))
    .filter(section => section.rows.length)

/**
 * Build paramsJson for WhatsApp NativeFlow single_select.
 */
export const buildSingleSelectParams = options => {
  const sections =
    cleanSections(options?.sections)

  if (!sections.length) {
    throw new Error(
      'VENEXVORA Fork: single_select requires at least one row'
    )
  }

  return JSON.stringify({
    title:
      ensureString(
        options?.title,
        'Pilih Menu'
      ),

    sections
  })
}

/**
 * Classic Type 6 ButtonsMessage.
 *
 * jpegThumbnail should be a Buffer.
 *
 * Maximum recommended classic buttons: 2-3.
 */
export const generateType6Buttons = options => {
  const buttons =
    ensureArray(options?.buttons)
      .slice(0, 3)
      .map((button, index) => ({
        buttonId:
          ensureString(
            button?.id ??
            button?.buttonId,
            `venexvora-btn-${index + 1}`
          ),

        buttonText: {
          displayText:
            ensureString(
              button?.text ??
              button?.displayText,
              `BUTTON ${index + 1}`
            )
        },

        type:
          proto.Message.ButtonsMessage
            .Button.Type.RESPONSE
      }))

  return {
    buttonsMessage:
      proto.Message.ButtonsMessage.create({
        contentText:
          ensureString(
            options?.text ??
            options?.body
          ),

        footerText:
          ensureString(
            options?.footer
          ),

        buttons,

        headerType: 6,

        locationMessage: {
          degreesLatitude:
            Number(
              options?.latitude ?? 0
            ),

          degreesLongitude:
            Number(
              options?.longitude ?? 0
            ),

          jpegThumbnail:
            options?.jpegThumbnail ??
            options?.thumbnail
        }
      })
  }
}

/**
 * Type 6 + NativeFlow SINGLE_SELECT popup.
 *
 * This is the hybrid Type 6 list requested for VENEXVORA.
 */
export const generateType6List = options => {
  const paramsJson =
    buildSingleSelectParams({
      title:
        options?.title ??
        options?.listTitle ??
        'Pilih Menu',

      sections:
        options?.sections
    })

  const buttonText =
    ensureString(
      options?.buttonText,
      'PILIH MENU'
    )

  return {
    buttonsMessage:
      proto.Message.ButtonsMessage.create({
        contentText:
          ensureString(
            options?.text ??
            options?.body
          ),

        footerText:
          ensureString(
            options?.footer
          ),

        buttons: [
          {
            buttonId:
              ensureString(
                options?.buttonId,
                'venexvora-single-select'
              ),

            buttonText: {
              displayText:
                buttonText
            },

            type:
              proto.Message.ButtonsMessage
                .Button.Type.NATIVE_FLOW,

            nativeFlowInfo: {
              name:
                'single_select',

              paramsJson
            }
          }
        ],

        headerType: 6,

        locationMessage: {
          degreesLatitude:
            Number(
              options?.latitude ?? 0
            ),

          degreesLongitude:
            Number(
              options?.longitude ?? 0
            ),

          jpegThumbnail:
            options?.jpegThumbnail ??
            options?.thumbnail
        }
      })
  }
}

/**
 * Raw modern NativeFlow SINGLE_SELECT.
 */
export const generateSingleSelect = options => {
  const buttonParamsJson =
    buildSingleSelectParams({
      title:
        options?.title ??
        'Pilih Menu',

      sections:
        options?.sections
    })

  return {
    interactiveMessage: {
      body: {
        text:
          ensureString(
            options?.text ??
            options?.body
          )
      },

      footer:
        options?.footer
          ? {
              text:
                ensureString(
                  options.footer
                )
            }
          : undefined,

      header:
        options?.header
          ? {
              title:
                ensureString(
                  options.header.title
                ),

              subtitle:
                ensureString(
                  options.header.subtitle
                ),

              hasMediaAttachment:
                Boolean(
                  options.header
                    .hasMediaAttachment
                )
            }
          : undefined,

      nativeFlowMessage: {
        buttons: [
          {
            name:
              'single_select',

            buttonParamsJson
          }
        ],

        messageParamsJson:
          ensureString(
            options?.messageParamsJson
          )
      }
    }
  }
}

/**
 * Universal NativeFlow button builder.
 *
 * Supported:
 * reply
 * url
 * copy
 * call
 * single_select
 */
export const generateVenexvoraButtons = options => {
  const buttons = []

  for (
    const button of
    ensureArray(options?.buttons)
  ) {
    switch (button?.type) {
      case 'reply':
      case 'quick_reply':
        buttons.push({
          name:
            'quick_reply',

          buttonParamsJson:
            JSON.stringify({
              display_text:
                ensureString(
                  button.text ??
                  button.displayText
                ),

              id:
                ensureString(
                  button.id
                )
            })
        })
        break

      case 'url':
      case 'cta_url':
        buttons.push({
          name:
            'cta_url',

          buttonParamsJson:
            JSON.stringify({
              display_text:
                ensureString(
                  button.text ??
                  button.displayText
                ),

              url:
                ensureString(
                  button.url
                ),

              merchant_url:
                ensureString(
                  button.merchantUrl ??
                  button.url
                )
            })
        })
        break

      case 'copy':
      case 'cta_copy':
        buttons.push({
          name:
            'cta_copy',

          buttonParamsJson:
            JSON.stringify({
              display_text:
                ensureString(
                  button.text ??
                  button.displayText ??
                  'SALIN'
                ),

              copy_code:
                ensureString(
                  button.value ??
                  button.copyCode
                )
            })
        })
        break

      case 'call':
      case 'cta_call':
        buttons.push({
          name:
            'cta_call',

          buttonParamsJson:
            JSON.stringify({
              display_text:
                ensureString(
                  button.text ??
                  button.displayText ??
                  'TELEPON'
                ),

              phone_number:
                ensureString(
                  button.phoneNumber
                )
            })
        })
        break

      case 'list':
      case 'single_select':
        buttons.push({
          name:
            'single_select',

          buttonParamsJson:
            buildSingleSelectParams({
              title:
                button.title ??
                button.text ??
                'Pilih Menu',

              sections:
                button.sections
            })
        })
        break

      default:
        throw new Error(
          `VENEXVORA Fork: unsupported button type "${button?.type}"`
        )
    }
  }

  if (!buttons.length) {
    throw new Error(
      'VENEXVORA Fork: buttons cannot be empty'
    )
  }

  return {
    interactiveMessage: {
      body: {
        text:
          ensureString(
            options?.text ??
            options?.body
          )
      },

      footer:
        options?.footer
          ? {
              text:
                ensureString(
                  options.footer
                )
            }
          : undefined,

      header:
        options?.header
          ? {
              title:
                ensureString(
                  options.header.title
                ),

              subtitle:
                ensureString(
                  options.header.subtitle
                ),

              hasMediaAttachment:
                Boolean(
                  options.header
                    .hasMediaAttachment
                )
            }
          : undefined,

      nativeFlowMessage: {
        buttons,

        messageParamsJson:
          ensureString(
            options?.messageParamsJson
          )
      }
    }
  }
}

/**
 * Convenience aliases.
 */

export const generateQuickReplyV2 = (
  text,
  buttons,
  options = {}
) =>
  generateVenexvoraButtons({
    ...options,
    text,
    buttons:
      ensureArray(buttons).map(button => ({
        type: 'reply',
        ...button
      }))
  })

export const generateUrlButtonsV2 = (
  text,
  buttons,
  options = {}
) =>
  generateVenexvoraButtons({
    ...options,
    text,
    buttons:
      ensureArray(buttons).map(button => ({
        type: 'url',
        ...button
      }))
  })

export const generateCopyButtonV2 = (
  text,
  value,
  buttonText = 'SALIN',
  options = {}
) =>
  generateVenexvoraButtons({
    ...options,
    text,
    buttons: [
      {
        type: 'copy',
        text:
          buttonText,
        value
      }
    ]
  })

export const generateCallButtonV2 = (
  text,
  phoneNumber,
  buttonText = 'TELEPON',
  options = {}
) =>
  generateVenexvoraButtons({
    ...options,
    text,
    buttons: [
      {
        type: 'call',
        text:
          buttonText,
        phoneNumber
      }
    ]
  })

/**
 * Feature information useful for diagnostics.
 */
export const VENEXVORA_INTERACTIVE_FEATURES =
  Object.freeze({
    type6: true,
    type6Buttons: true,
    type6SingleSelect: true,
    type6Popup: true,
    nativeFlow: true,
    quickReply: true,
    urlButton: true,
    copyButton: true,
    callButton: true,
    singleSelect: true,
    carouselProto: true,
    carouselV2: true,
    richHtml: true,
    richResponseProto: true
  })

/**
 * VENEXVORA Fork Type 6 Popup
 *
 * Layout:
 * - Type 6 thumbnail header
 * - Content text
 * - ONE full-width NativeFlow button
 * - Button opens single_select popup
 *
 * Alias khusus agar developer langsung paham
 * bahwa helper ini menghasilkan Type6 popup.
 */
export const generateType6Popup = options =>
  generateType6List({
    ...options,

    buttonText:
      ensureString(
        options?.buttonText,
        'PILIH MENU'
      ),

    buttonId:
      ensureString(
        options?.buttonId,
        'venexvora-type6-popup'
      )
  })

/**
 * ============================================================
 * VENEXVORA Fork CAROUSEL V2
 * ============================================================
 *
 * Creates a raw InteractiveMessage carousel.
 *
 * Cards may contain:
 * - body
 * - footer
 * - header
 * - NativeFlow buttons
 *
 * Media header can be passed as an already prepared
 * InteractiveMessage.Header object.
 */

export const generateCarouselV2 = options => {
  const cards =
    ensureArray(options?.cards)

  if (!cards.length) {
    throw new Error(
      'VENEXVORA Fork: carousel requires at least one card'
    )
  }

  const normalizedCards =
    cards.map((card, index) => {
      const native =
        card?.buttons?.length
          ? generateVenexvoraButtons({
              text:
                ensureString(
                  card?.text ??
                  card?.body
                ),

              buttons:
                card.buttons
            })
              .interactiveMessage
              .nativeFlowMessage
          : undefined

      return {
        body: {
          text:
            ensureString(
              card?.text ??
              card?.body,
              `Card ${index + 1}`
            )
        },

        footer:
          card?.footer
            ? {
                text:
                  ensureString(
                    card.footer
                  )
              }
            : undefined,

        header:
          card?.header
            ? {
                ...card.header,

                hasMediaAttachment:
                  Boolean(
                    card.header
                      .hasMediaAttachment
                  )
              }
            : undefined,

        nativeFlowMessage:
          native
      }
    })

  return {
    interactiveMessage: {
      body: {
        text:
          ensureString(
            options?.text ??
            options?.body
          )
      },

      footer:
        options?.footer
          ? {
              text:
                ensureString(
                  options.footer
                )
            }
          : undefined,

      header:
        options?.header
          ? {
              ...options.header,

              hasMediaAttachment:
                Boolean(
                  options.header
                    .hasMediaAttachment
                )
            }
          : undefined,

      carouselMessage: {
        cards:
          normalizedCards,

        messageVersion:
          Number(
            options?.messageVersion ??
            1
          )
      }
    }
  }
}

/**
 * ============================================================
 * VENEXVORA Fork RICH HTML
 * ============================================================
 *
 * Builds the unifiedResponse envelope used by WhatsApp's
 * RichResponse/BotForwarded message primitives.
 *
 * This only builds the message payload.
 * Rendering capability still depends on the receiving
 * WhatsApp client/version.
 */

export const generateVenexvoraRichHtml = options => {
  const html =
    ensureString(
      options?.html
    )

  if (!html) {
    throw new Error(
      'VENEXVORA Fork: Rich HTML requires html'
    )
  }

  const primitive = {
    type:
      'GenAIaeacdsnwHtmlPrimitive',

    html
  }

  const unifiedPayload = {
    type:
      'GenAISingleLayoutViewModel',

    children: [
      primitive
    ]
  }

  const encoded =
    Buffer.from(
      JSON.stringify(
        unifiedPayload
      ),
      'utf8'
    ).toString(
      'base64'
    )

  return {
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          unifiedResponse: {
            data:
              encoded
          }
        }
      }
    }
  }
}

/**
 * Alias for developers who prefer a shorter name.
 */
export const generateRichHtml =
  generateVenexvoraRichHtml
