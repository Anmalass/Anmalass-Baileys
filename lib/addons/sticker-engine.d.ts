
export interface SoundStickerAssets {
    sticker: Buffer;
    audio: Buffer;
}

export interface StickerWatermarkOptions {
    fontSize?: number;
    fontColor?: string;
    position?: 'top' | 'center' | 'bottom';
    quality?: number;
    fontFile?: string;
}

export type SoundStickerInput =
    | Buffer
    | { video: Buffer }
    | SoundStickerAssets;

export declare function createSoundStickerAssets(
    input: Buffer
): Promise<SoundStickerAssets>;

export declare function watermarkSticker(
    input: Buffer,
    watermark: string,
    options?: StickerWatermarkOptions
): Promise<Buffer>;

export declare function watermarkSoundSticker(
    assets: SoundStickerAssets,
    watermark: string,
    options?: StickerWatermarkOptions
): Promise<SoundStickerAssets>;
