import { proto } from '../../WAProto/index.js';
import type { MessageContentGenerationOptions } from '../Types/index.js';
import type { AdminInviteInfo, CallCreationInfo, PaymentInviteInfo, StickerPack } from '../Types/Message.js';
/**
 * Build newsletterAdminInviteMessage from adminInvite content
 * Source: messages.ts → adminInvite block
 */
export declare function buildAdminInviteMessage(adminInvite: AdminInviteInfo, contextInfo: any, options: MessageContentGenerationOptions): Promise<proto.Message.INewsletterAdminInviteMessage>;
/**
 * Build scheduledCallCreationMessage from call content
 * Source: messages.ts → call block
 */
export declare function buildCallMessage(call: CallCreationInfo): proto.Message.IScheduledCallCreationMessage;
/**
 * Build paymentInviteMessage from paymentInvite content
 * Source: messages.ts → paymentInvite block
 */
export declare function buildPaymentInviteMessage(paymentInvite: PaymentInviteInfo): proto.Message.IPaymentInviteMessage;
/**
 * Check if buffer is a valid WebP file (magic bytes: RIFF....WEBP)
 * Source: PR #84 rsalcara/InfiniteAPI
 */
export declare function isWebPBuffer(buffer: Buffer): boolean;
/**
 * Detect animated WebP by checking VP8X chunk animation flag
 * Source: PR #84 rsalcara/InfiniteAPI
 */
export declare function isAnimatedWebP(buffer: Buffer): boolean;
/**
 * Detect Lottie/WAS format (gzip-compressed or raw Lottie JSON)
 * WAS = WhatsApp Animated Sticker = gzip-compressed Lottie JSON
 * Source: PR #260 rsalcara/InfiniteAPI
 */
export declare function isLottieBuffer(buffer: Buffer): boolean;
/**
 * Build stickerPackMessage following PR #1561 (WhiskeySockets) + PR #84 + PR #260 approach:
 *
 * Architecture:
 * 1. Process stickers → WebP/WAS buffers (with Lottie support from PR #260)
 * 2. Cover (tray icon) → add to ZIP as ${packId}.webp inside ZIP
 * 3. ZIP everything → encrypt → upload as 'sticker-pack'
 * 4. Generate 252x252 JPEG thumbnail from cover → encrypt with SAME mediaKey → upload as 'thumbnail-sticker-pack'
 * 5. Return full IStickerPackMessage with both upload results
 *
 * KEY FIXES vs old implementation:
 * - Cover goes INSIDE ZIP (not uploaded separately as image)
 * - Thumbnail is separate 252x252 JPEG upload with same mediaKey
 * - stickerPackOrigin: USER_CREATED (not THIRD_PARTY)
 * - thumbnail-sticker-pack media type for thumbnail
 */
export declare function buildStickerPackMessage(stickerPack: StickerPack, options: MessageContentGenerationOptions): Promise<proto.Message.IStickerPackMessage>;
//# sourceMappingURL=from-messages.d.ts.map