/**
 * message-composer.ts (addons)
 * Rich message builders for Meta AI / Bot botForwardedMessage payloads.
 * Ported from WhiskeySockets/Baileys main (April 2026).
 */
import type { proto } from '../../WAProto/index.js';
export declare const JS_KEYWORDS: Set<string>;
export declare const PYTHON_KEYWORDS: Set<string>;
export declare const LANGUAGE_KEYWORDS: Record<string, Set<string>>;
export declare enum CodeHighlightType {
    DEFAULT = 0,
    KEYWORD = 1,
    METHOD = 2,
    STRING = 3,
    NUMBER = 4,
    COMMENT = 5
}
export declare enum RichSubMessageType {
    UNKNOWN = 0,
    GRID_IMAGE = 1,
    TEXT = 2,
    INLINE_IMAGE = 3,
    TABLE = 4,
    CODE = 5,
    DYNAMIC = 6,
    MAP = 7,
    LATEX = 8,
    CONTENT_ITEMS = 9
}
export type CodeToken = {
    highlightType: CodeHighlightType;
    codeContent: string;
};
export type LatexExpression = {
    latexExpression: string;
    url?: string;
    width?: number;
    height?: number;
    fontHeight?: number;
    imageTopPadding?: number;
    imageLeadingPadding?: number;
    imageBottomPadding?: number;
    imageTrailingPadding?: number;
};
export type RichSubMessage = {
    messageType: RichSubMessageType | number;
    messageText?: string;
    tableMetadata?: {
        title: string;
        rows: Array<{
            items: string[];
            isHeading?: boolean;
        }>;
    };
    codeMetadata?: {
        codeLanguage: string;
        codeBlocks: CodeToken[];
    };
    latexMetadata?: {
        text: string;
        expressions: LatexExpression[];
    };
    imageMetadata?: {
        imageUrl: {
            imagePreviewUrl: string;
            imageHighResUrl: string;
        };
        imageText?: string;
        alignment?: number;
    };
};
export type RichMessageContent = {
    message: proto.IMessage;
    messageId: string;
};
export type CapturedUnifiedResponse = {
    unifiedResponse: {
        data: Buffer | Uint8Array;
    };
    submessages: RichSubMessage[];
    contextInfo: Record<string, unknown>;
};
type QuotedMsg = {
    key?: proto.IMessageKey;
    message?: proto.IMessage | null;
    sender?: string;
} | undefined;
export declare const tokenizeCode: (codeStr: string, language?: string) => CodeToken[];
export declare const buildRichContextInfo: (quoted?: QuotedMsg) => Record<string, unknown>;
export declare const buildBotForwardedMessage: (submessages: RichSubMessage[], contextInfo: Record<string, unknown>, unifiedResponse?: {
    data: Buffer | Uint8Array;
}) => proto.IMessage;
export declare const generateTableContent: (title: string, headers: string[], rows: string[][], quoted?: QuotedMsg, options?: {
    headerText?: string;
    footer?: string;
}) => RichMessageContent;
export declare const generateListContent: (title: string, items: string[] | string[][], quoted?: QuotedMsg, options?: {
    headerText?: string;
    footer?: string;
}) => RichMessageContent;
export declare const generateCodeBlockContent: (code: string, quoted?: QuotedMsg, options?: {
    title?: string;
    footer?: string;
    language?: string;
}) => RichMessageContent;
export declare const generateLatexContent: (quoted: QuotedMsg, options: {
    text?: string;
    expressions: LatexExpression[];
    headerText?: string;
    footer?: string;
}) => RichMessageContent;
export declare const generateLatexImageContent: (quoted: QuotedMsg, options: {
    text?: string;
    expressions: LatexExpression[];
    headerText?: string;
    footer?: string;
}, uploadFn: (buffer: Buffer, type: string) => Promise<{
    url?: string;
    directPath?: string;
}>, renderLatexToPng: (latexExpr: string) => Promise<{
    buffer: Buffer;
    width: number;
    height: number;
}>) => Promise<RichMessageContent>;
export declare const generateLatexInlineImageContent: (quoted: QuotedMsg, options: {
    text?: string;
    expressions: LatexExpression[];
    headerText?: string;
    footer?: string;
}, uploadFn: (buffer: Buffer, type: string) => Promise<{
    url?: string;
    directPath?: string;
}>, renderLatexToPng: (latexExpr: string) => Promise<{
    buffer: Buffer;
    width: number;
    height: number;
}>) => Promise<RichMessageContent>;
export declare const extractUnifiedResponse: (msg: proto.IMessage | null | undefined) => CapturedUnifiedResponse | null;
export declare const generateUnifiedResponseContent: (quoted: QuotedMsg, captured: CapturedUnifiedResponse) => RichMessageContent;
export declare const generateRichMessageContent: (submessages: RichSubMessage[], quoted?: QuotedMsg) => RichMessageContent;
export {};
//# sourceMappingURL=message-composer.d.ts.map