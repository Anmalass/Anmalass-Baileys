/**
 * venexvora-fork — src/addons
 * VENEXVORA Fork structure with WS-patched features merged in
 *
 * Quick reference:
 *   Button sender         → sendButtons, sendInteractiveMessage, sendListMessage ...
 *   Anti-delete           → MessageStore, createAntiDeleteHandler, createMessageStoreHandler
 *   Scheduler             → MessageScheduler, ScheduledMessageStatus, createMessageScheduler
 *   Auto-reply            → AutoReplyHandler, createAutoReply
 *   vCard                 → generateVCard, createContactCard, quickContact
 *   Status                → createTextStatus, createImageStatus, StatusHelper (TextStatusOptions, MediaStatusOptions)
 *   Status mentions       → makeStatusMentionsAddon → sendStatusMentions
 *   Templates             → TemplateManager, renderTemplate, PRESET_TEMPLATES
 *   JID utils             → parseJid, plotJid, JidPlotterWithMapping, createJidPlotter
 *   JID plot (innov.)     → JidPlot, buildJidPlot, resolveJidPlot
 *   Message utils         → getMediaType, getMessageType, getButtonType, getButtonArgs
 *   Message WS extras     → buildMentionContextInfo, patchMessageForMdIfRequired,
 *                           prepareAlbumMessageContent, normalizeMediaInput
 *   Socket extras         → makeMessageExtrasAddon → profilePictureUrl, getEphemeralGroup
 *   Message search        → MessageType, RegexSearchOptions, searchMessages,
 *                           searchMessagesRegex, MessageSearchManager, createMessageSearch
 *   Interactive msgs      → generateInteractiveButtonMessage, generateTemplateMessage,
 *                           generateNativeFlowMessage, generateCombinedButtons ...
 *   Call handler          → makeCallHandlerAddon → initiateCall, acceptCall, muteCall ...
 *   Generics extras       → asciiDecode, getPlatformId, printQRIfNecessaryListener
 *   Rich response (innov.)→ sendTable, sendList, sendCodeBlock, sendLatex ...
 *   Scheduler (innov.)    → schedule, cancelScheduled, listScheduled ...
 *   Auth state            → useSingleFileAuthState, useMongoFileAuthState
 *
 *   From src/ re-exports (inherited helper implementations):
 *     from-chats.ts         → chat socket helpers
 *     from-messages-recv.ts → messages-recv helpers
 *     from-messages-send.ts → StatusMentionDeps, normalizeStatusContent, buildStatusMentionNode
 *     from-messages.ts      → message content builders (buttons, stickers, albums...)
 *
 * NOTE: The following patch features are baked directly into Socket/Utils source:
 *   pairing-fix         → src/Socket/socket.ts
 *   browser-presets     → src/Utils/browser-utils.ts + src/Socket/socket.ts
 *   lid-support         → src/WABinary/jid-utils.ts
 *   outgoing-calls      → src/Socket/chats.ts + src/Socket/messages-recv.ts
 *   mex-linked-profiles → src/Socket/messages-recv.ts
 *   past-participants   → src/Utils/history.ts + src/Utils/event-buffer.ts
 *   privacy-tokens      → src/Socket/messages-send.ts
 *   stickerpack         → src/addons/from-messages.ts (buildStickerPackMessage)
 */
export * from './button-sender.js';
export * from './anti-delete.js';
export * from './auto-reply.js';
export * from './vcard.js';
export * from './status-posting.js';
export * from './templates.js';
export * from './jid-plotting.js';
export * from './jid-plot.js';
export * from './message-utils.js';
export * from './message-composer.js';
export * from './message-search.js';
export * from './call-handler.js';
export * from './scheduling.js';
export * from './message-scheduler.js';
export * from './rich-response.js';
export * from './from-chats.js';
export * from './from-messages-recv.js';
export * from './from-messages-send.js';
export * from './from-messages.js';
export { useSingleFileAuthState } from '../Utils/use-single-file-auth-state.js';
export { useMongoFileAuthState } from '../Utils/use-mongo-file-auth-state.js';

export * from './venexvora-brand.js';

export * from './venexvora-interactive.js';

export * from './venexvora-message.js';
export * from './venexvora-button-v2.js';

export * from './venexvora-session-inspector.js';

export * from './venexvora-session-manager.js';

export * from './venexvora-session-lock.js';

export * from './venexvora-jadibot-factory.js';
export * from './venexvora-jadibot-restorer.js';
export * from './venexvora-jadibot-runtime.js';
export * from './venexvora-smart-cache.js';
export * from './venexvora-request-deduper.js';
export * from './venexvora-request-optimizer.js';
export * from './venexvora-smart-retry.js';
export * from './venexvora-action-lock.js';
export * from './venexvora-action-verifier.js';
export * from './venexvora-self-healing.js';
export * from './venexvora-runtime-watchdog.js';
export * from './venexvora-health.js';
export * from './venexvora-sdk.js';
export * from './venexvora-flow.js';
export * from './venexvora-flow-message.js';
