import { proto } from '../../WAProto/index.js';
import { type BinaryNode } from './types.js';
export declare const getBinaryNodeChildren: (node: BinaryNode | undefined, childTag: string) => BinaryNode[];
export declare const getBinaryNodeChild: (node: BinaryNode | undefined, childTag: string) => BinaryNode | undefined;
export declare const getAllBinaryNodeChildren: ({ content }: BinaryNode) => BinaryNode[];
export declare const getBinaryNodeChildBuffer: (node: BinaryNode | undefined, childTag: string) => Uint8Array<ArrayBufferLike> | Buffer<ArrayBufferLike> | undefined;
export declare const getBinaryNodeChildString: (node: BinaryNode | undefined, childTag: string) => string | undefined;
export declare const getBinaryNodeChildUInt: (node: BinaryNode, childTag: string, length: number) => number | undefined;
export declare const assertNodeErrorFree: (node: BinaryNode) => void;
export declare const reduceBinaryNodeToDictionary: (node: BinaryNode, tag: string) => {
    [_: string]: string;
};
export declare const getBinaryNodeMessages: ({ content }: BinaryNode) => proto.WebMessageInfo[];
/**
 * Returns truthy if the additionalNodes array already contains a <biz> / button node
 * so relayMessage doesn't inject a duplicate.
 */
export declare const getBinaryFilteredButtons: (nodeContent: BinaryNode | BinaryNode["content"]) => BinaryNode["content"];
/**
 * Returns truthy if the additionalNodes array already contains a <bot> biz_bot node.
 */
export declare const getBinaryFilteredBizBot: (nodeContent: BinaryNode | BinaryNode["content"]) => BinaryNode["content"];
export declare function binaryNodeToString(node: BinaryNode | BinaryNode['content'], i?: number): string;
//# sourceMappingURL=generic-utils.d.ts.map