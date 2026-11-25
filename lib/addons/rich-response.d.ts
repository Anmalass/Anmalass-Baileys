/**
 * Rich Response Utilities
 * sendTable, sendList, sendCodeBlock, sendLatex, sendLatexImage,
 * sendLatexInlineImage, sendRichMessage, captureUnifiedResponse, sendUnifiedResponse
 */
import type { AnyMessageContent, MiscMessageGenerationOptions } from '../Types/index.js';
type SendFn = (jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions) => Promise<any>;
/**
 * Format a 2D array as a plain-text table and send it.
 * @example sendTable(sock.sendMessage, jid, [['Name','Age'],['Alice','30']])
 */
export declare const sendTable: (sendMessage: SendFn, jid: string, rows: string[][], opts?: {
    title?: string;
    headerRow?: boolean;
} & MiscMessageGenerationOptions) => Promise<void>;
/**
 * Format an array of items as a numbered or bulleted list and send it.
 */
export declare const sendList: (sendMessage: SendFn, jid: string, items: string[], opts?: {
    title?: string;
    ordered?: boolean;
} & MiscMessageGenerationOptions) => Promise<void>;
/**
 * Send a code block (wrapped in triple backticks).
 * language is a hint for syntax highlighting in clients that support it.
 */
export declare const sendCodeBlock: (sendMessage: SendFn, jid: string, code: string, opts?: {
    language?: string;
    title?: string;
} & MiscMessageGenerationOptions) => Promise<void>;
/**
 * Send a LaTeX expression as raw text (wrapped in backticks).
 * Note: WhatsApp does not natively render LaTeX. This sends the raw expression.
 */
export declare const sendLatex: (sendMessage: SendFn, jid: string, expression: string, opts?: MiscMessageGenerationOptions) => Promise<void>;
/**
 * Render a LaTeX expression to a PNG image via an external API (e.g. quicklatex.com)
 * and send it as an image message.
 */
export declare const sendLatexImage: (sendMessage: SendFn, jid: string, expression: string, opts?: {
    caption?: string;
} & MiscMessageGenerationOptions) => Promise<void>;
/**
 * Render a LaTeX expression to PNG and send it inline (as image with expression as caption).
 */
export declare const sendLatexInlineImage: (sendMessage: SendFn, jid: string, expression: string, opts?: MiscMessageGenerationOptions) => Promise<void>;
type RichTextTable = {
    rows: string[][];
    headerRow?: boolean;
    title?: string;
};
type RichTextList = {
    items: string[];
    ordered?: boolean;
    title?: string;
};
type CodeBlockOptions = {
    code: string;
    language?: string;
};
type LatexOptions = {
    expression: string;
};
type RichMessageOptions = {
    parts: ({
        type: 'text';
        text: string;
    } | {
        type: 'table';
        table: RichTextTable;
    } | {
        type: 'list';
        list: RichTextList;
    } | {
        type: 'code';
        code: CodeBlockOptions;
    } | {
        type: 'latex';
        latex: LatexOptions;
    })[];
    caption?: string;
};
/**
 * Send a rich message composed of mixed content parts (text, table, list, code, latex).
 */
export declare const sendRichMessage: (sendMessage: SendFn, jid: string, rich: RichMessageOptions, opts?: MiscMessageGenerationOptions) => Promise<void>;
export type UnifiedResponseEntry = {
    jid: string;
    content: AnyMessageContent;
    options?: MiscMessageGenerationOptions;
};
/**
 * Capture a response without immediately sending it.
 * Useful for building batched sends.
 */
export declare const captureUnifiedResponse: (jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions) => UnifiedResponseEntry;
/**
 * Send all captured unified responses and clear the capture buffer.
 * Returns the results in order.
 */
export declare const sendUnifiedResponse: (sendMessage: SendFn) => Promise<any[]>;
/**
 * Clear captured responses without sending them
 */
export declare const clearCapturedResponses: () => void;
/**
 * Get current captured responses without clearing
 */
export declare const getCapturedResponses: () => UnifiedResponseEntry[];
export {};
//# sourceMappingURL=rich-response.d.ts.map