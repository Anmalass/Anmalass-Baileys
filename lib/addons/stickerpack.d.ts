/**
 * addon: stickerpack
 * Source patch: Baileys-feat-add-stickerpack-support
 *
 * Adds support for sending WhatsApp Sticker Pack messages.
 * Sticker and StickerPack types are the canonical definitions in Types/Message.ts.
 *
 * This addon exports:
 *   - buildStickerPackProto() — builds the proto payload for a StickerPackMessage
 *   - generateStickerPackId() — generates a random pack ID
 *   - STICKER_PACK_MESSAGE_TYPE — the message type string 'sticker_pack'
 */
export type { Sticker, StickerPack } from '../Types/index.js';
/**
 * Generate a random sticker pack ID (16 hex chars).
 */
export declare const generateStickerPackId: () => string;
/**
 * Build the proto-level stickerPackMessage payload.
 * The result can be passed directly as the stickerPackMessage field in a proto.IMessage.
 */
export declare const buildStickerPackProto: (pack: {
    name: string;
    publisher: string;
    packId?: string;
    description?: string;
}) => {
    name: string;
    publisher: string;
    packId: string;
    description: string;
};
/**
 * stickerPack message type marker — getMediaType() returns this for stickerPackMessage.
 */
export declare const STICKER_PACK_MESSAGE_TYPE: "sticker_pack";
//# sourceMappingURL=stickerpack.d.ts.map