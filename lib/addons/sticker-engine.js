import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FONT = '/system/fonts/DroidSans-Bold.ttf';

const runFFmpeg = (args, timeout = 60000) =>
    new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
        let stderr = '';

        const timer = setTimeout(() => {
            process.kill('SIGKILL');
            reject(new Error('FFmpeg processing timeout'));
        }, timeout);

        process.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });

        process.on('error', error => {
            clearTimeout(timer);
            reject(error);
        });

        process.on('close', code => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg failed: ${stderr}`));
        });
    });

export const watermarkSticker = async (input, watermark, options = {}) => {
    if (!Buffer.isBuffer(input)) {
        throw new TypeError('Sticker input must be a Buffer');
    }

    if (!watermark || typeof watermark !== 'string') {
        throw new TypeError('Watermark must be a non-empty string');
    }

    const {
        fontSize = 28,
        fontColor = 'white',
        position = 'bottom',
        quality = 85,
        fontFile = FONT
    } = options;

    const directory = await mkdtemp(join(tmpdir(), 'anmalass-sticker-'));

    try {
        const inputPath = join(directory, 'input.webp');
        const outputPath = join(directory, 'output.webp');
        const textPath = join(directory, 'watermark.txt');

        await Promise.all([
            writeFile(inputPath, input),
            writeFile(textPath, watermark, 'utf8')
        ]);

        const y = position === 'top'
            ? '24'
            : position === 'center'
                ? '(h-text_h)/2'
                : 'h-text_h-24';

        const filter =
            `drawtext=fontfile=${fontFile}:textfile=${textPath}:` +
            `fontcolor=${fontColor}:fontsize=${fontSize}:` +
            `x=(w-text_w)/2:y=${y}:` +
            'borderw=2:bordercolor=black@0.65';

        await runFFmpeg([
            '-i', inputPath,
            '-vf', filter,
            '-an',
            '-c:v', 'libwebp_anim',
            '-loop', '0',
            '-q:v', String(quality),
            outputPath
        ]);

        return await readFile(outputPath);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
};

export const createSoundStickerAssets = async (input) => {
    if (!Buffer.isBuffer(input)) {
        throw new TypeError('Video input must be a Buffer');
    }

    const directory = await mkdtemp(join(tmpdir(), 'anmalass-sound-'));

    try {
        const inputPath = join(directory, 'input.mp4');
        const stickerPath = join(directory, 'sticker.webp');
        const audioPath = join(directory, 'audio.ogg');

        await writeFile(inputPath, input);

        const probe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'stream=codec_type',
            '-of', 'json',
            inputPath
        ]);

        let stdout = '';
        let stderr = '';

        probe.stdout.on('data', chunk => stdout += chunk);
        probe.stderr.on('data', chunk => stderr += chunk);

        const exitCode = await new Promise((resolve, reject) => {
            probe.on('error', reject);
            probe.on('close', resolve);
        });

        if (exitCode !== 0) {
            throw new Error(`FFprobe failed: ${stderr}`);
        }

        const streams = JSON.parse(stdout).streams || [];

        if (!streams.some(stream => stream.codec_type === 'video')) {
            throw new Error('Input does not contain a video stream');
        }

        if (!streams.some(stream => stream.codec_type === 'audio')) {
            throw new Error('Input video does not contain an audio stream');
        }

        await runFFmpeg([
            '-i', inputPath,
            '-map', '0:v:0',
            '-an',
            '-vf',
            'fps=15,scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black',
            '-c:v', 'libwebp_anim',
            '-loop', '0',
            '-q:v', '80',
            stickerPath
        ]);

        await runFFmpeg([
            '-i', inputPath,
            '-map', '0:a:0',
            '-vn',
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-vbr', 'on',
            '-ac', '1',
            '-ar', '48000',
            '-f', 'ogg',
            audioPath
        ]);

        return {
            sticker: await readFile(stickerPath),
            audio: await readFile(audioPath)
        };
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
};
export const watermarkSoundSticker = async (assets, watermark, options = {}) => {
    if (!assets || !Buffer.isBuffer(assets.sticker) || !Buffer.isBuffer(assets.audio)) {
        throw new TypeError('Expected sticker and audio Buffers');
    }

    const sticker = await watermarkSticker(
        assets.sticker,
        watermark,
        options
    );

    return {
        ...assets,
        sticker,
        audio: assets.audio
    };
};
