type WebkitWindow = Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
};

export type SnookerAudioCue =
    | 'uiTap'
    | 'uiOpen'
    | 'uiClose'
    | 'cuePlace'
    | 'cueStrike'
    | 'ballCollision'
    | 'railCollision'
    | 'pocket'
    | 'foul'
    | 'achievement'
    | 'settlement';

export interface SnookerAudioPlayOptions {
    intensity?: number;
}

export class SnookerAudio {
    private enabled = true;
    private context: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;
    private readonly lastPlayedAt: Partial<Record<SnookerAudioCue, number>> = {};

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!this.masterGain || !this.context) {
            return;
        }
        const now = this.context.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(enabled ? 0.22 : 0.0001, now, 0.018);
    }

    public unlock(): void {
        const context = this.ensureContext();
        if (!context || context.state === 'running') {
            return;
        }
        void context.resume().catch(() => undefined);
    }

    public dispose(): void {
        if (!this.context) {
            return;
        }
        const context = this.context;
        this.context = null;
        this.masterGain = null;
        this.noiseBuffer = null;
        void context.close().catch(() => undefined);
    }

    public play(cue: SnookerAudioCue, options: SnookerAudioPlayOptions = {}): void {
        if (!this.enabled) {
            return;
        }
        const context = this.ensureContext();
        if (!context) {
            return;
        }
        if (context.state !== 'running') {
            void context.resume()
                .then(() => {
                    if (this.enabled) {
                        this.play(cue, options);
                    }
                })
                .catch(() => undefined);
            return;
        }
        if (this.shouldThrottle(cue)) {
            return;
        }

        const intensity = this.clamp(options.intensity ?? 0.72, 0.2, 1.3);
        switch (cue) {
            case 'uiTap':
                this.playUiTap(intensity);
                break;
            case 'uiOpen':
                this.playUiOpen(intensity);
                break;
            case 'uiClose':
                this.playUiClose(intensity);
                break;
            case 'cuePlace':
                this.playCuePlace(intensity);
                break;
            case 'cueStrike':
                this.playCueStrike(intensity);
                break;
            case 'ballCollision':
                this.playBallCollision(intensity);
                break;
            case 'railCollision':
                this.playRailCollision(intensity);
                break;
            case 'pocket':
                this.playPocket(intensity);
                break;
            case 'foul':
                this.playFoul(intensity);
                break;
            case 'achievement':
                this.playAchievement(intensity);
                break;
            case 'settlement':
                this.playSettlement(intensity);
                break;
            default:
                break;
        }
    }

    private ensureContext(): AudioContext | null {
        if (this.context) {
            return this.context;
        }
        if (typeof window === 'undefined') {
            return null;
        }
        const audioWindow = window as WebkitWindow;
        const ContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
        if (!ContextConstructor) {
            return null;
        }
        const context = new ContextConstructor();
        const masterGain = context.createGain();
        masterGain.gain.value = this.enabled ? 0.22 : 0.0001;
        masterGain.connect(context.destination);
        this.context = context;
        this.masterGain = masterGain;
        this.noiseBuffer = this.createNoiseBuffer(context);
        return context;
    }

    private createNoiseBuffer(context: AudioContext): AudioBuffer {
        const duration = 0.32;
        const length = Math.max(1, Math.floor(context.sampleRate * duration));
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const channel = buffer.getChannelData(0);
        let previous = 0;
        for (let index = 0; index < length; index++) {
            const white = Math.random() * 2 - 1;
            previous = previous * 0.82 + white * 0.18;
            channel[index] = previous;
        }
        return buffer;
    }

    private shouldThrottle(cue: SnookerAudioCue): boolean {
        const gapMs = this.getThrottleGapMs(cue);
        if (gapMs <= 0) {
            return false;
        }
        const now = Date.now();
        const previous = this.lastPlayedAt[cue] ?? 0;
        if (now - previous < gapMs) {
            return true;
        }
        this.lastPlayedAt[cue] = now;
        return false;
    }

    private getThrottleGapMs(cue: SnookerAudioCue): number {
        switch (cue) {
            case 'ballCollision':
                return 52;
            case 'railCollision':
                return 72;
            case 'pocket':
                return 84;
            default:
                return 0;
        }
    }

    private playUiTap(intensity: number): void {
        const now = this.context!.currentTime;
        this.scheduleTone('triangle', 820, 1120, 0.06, 0.035 + intensity * 0.026, now, 0.004);
        this.scheduleTone('sine', 560, 700, 0.08, 0.016 + intensity * 0.014, now + 0.008, 0.006);
    }

    private playUiOpen(intensity: number): void {
        const now = this.context!.currentTime;
        this.scheduleTone('triangle', 480, 760, 0.1, 0.024 + intensity * 0.02, now, 0.01);
        this.scheduleTone('sine', 720, 980, 0.14, 0.02 + intensity * 0.016, now + 0.03, 0.01);
    }

    private playUiClose(intensity: number): void {
        const now = this.context!.currentTime;
        this.scheduleTone('triangle', 820, 560, 0.08, 0.022 + intensity * 0.016, now, 0.008);
        this.scheduleTone('sine', 520, 400, 0.12, 0.014 + intensity * 0.014, now + 0.01, 0.01);
    }

    private playCuePlace(intensity: number): void {
        const now = this.context!.currentTime;
        this.scheduleTone('triangle', 360, 280, 0.08, 0.02 + intensity * 0.018, now, 0.01);
        this.scheduleNoiseBurst(900, 2200, 0.05, 0.01 + intensity * 0.014, now, 0.004);
    }

    private playCueStrike(intensity: number): void {
        const now = this.context!.currentTime;
        const normalized = this.clamp(intensity, 0.35, 1.25);
        this.scheduleTone('triangle', 220 + normalized * 90, 140 + normalized * 30, 0.12, 0.024 + normalized * 0.04, now, 0.004);
        this.scheduleTone('sine', 740 + normalized * 240, 460 + normalized * 100, 0.08, 0.018 + normalized * 0.026, now, 0.003);
        this.scheduleNoiseBurst(1600, 5200, 0.06, 0.012 + normalized * 0.03, now, 0.003);
    }

    private playBallCollision(intensity: number): void {
        const now = this.context!.currentTime;
        const frequency = 320 + intensity * 260;
        this.scheduleTone('sine', frequency, frequency * 1.18, 0.05, 0.014 + intensity * 0.026, now, 0.003);
        this.scheduleTone('triangle', frequency * 0.72, frequency * 0.8, 0.06, 0.008 + intensity * 0.018, now + 0.002, 0.003);
    }

    private playRailCollision(intensity: number): void {
        const now = this.context!.currentTime;
        const frequency = 170 + intensity * 90;
        this.scheduleTone('triangle', frequency, Math.max(90, frequency * 0.72), 0.1, 0.018 + intensity * 0.024, now, 0.005);
        this.scheduleNoiseBurst(300, 1200, 0.08, 0.012 + intensity * 0.02, now, 0.004);
    }

    private playPocket(intensity: number): void {
        const now = this.context!.currentTime;
        const peak = 0.02 + intensity * 0.024;
        this.scheduleTone('sine', 420 + intensity * 70, 180, 0.16, peak, now, 0.01);
        this.scheduleTone('triangle', 220, 110, 0.2, peak * 0.6, now + 0.012, 0.012);
        this.scheduleNoiseBurst(180, 900, 0.12, 0.01 + intensity * 0.018, now, 0.008);
    }

    private playFoul(intensity: number): void {
        const now = this.context!.currentTime;
        this.scheduleTone('sawtooth', 520, 220, 0.16, 0.02 + intensity * 0.02, now, 0.01);
        this.scheduleTone('triangle', 340, 140, 0.22, 0.016 + intensity * 0.018, now + 0.04, 0.01);
    }

    private playAchievement(intensity: number): void {
        const now = this.context!.currentTime;
        const peak = 0.016 + intensity * 0.016;
        this.scheduleTone('triangle', 660, 660, 0.12, peak, now, 0.01);
        this.scheduleTone('triangle', 840, 840, 0.12, peak * 0.96, now + 0.07, 0.01);
        this.scheduleTone('sine', 1120, 1120, 0.18, peak * 0.92, now + 0.14, 0.012);
    }

    private playSettlement(intensity: number): void {
        const now = this.context!.currentTime;
        const peak = 0.018 + intensity * 0.018;
        this.scheduleTone('triangle', 392, 392, 0.2, peak, now, 0.012);
        this.scheduleTone('triangle', 494, 494, 0.22, peak * 0.9, now + 0.04, 0.012);
        this.scheduleTone('sine', 587, 587, 0.24, peak * 0.86, now + 0.08, 0.014);
        this.scheduleTone('sine', 784, 784, 0.3, peak * 0.82, now + 0.14, 0.016);
    }

    private scheduleTone(
        wave: OscillatorType,
        startFrequency: number,
        endFrequency: number,
        duration: number,
        peak: number,
        startTime: number,
        attack: number,
    ): void {
        if (!this.context || !this.masterGain) {
            return;
        }
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(Math.max(40, startFrequency), startTime);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), startTime + duration);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(duration * 0.4, attack));
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        oscillator.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
        oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
        };
    }

    private scheduleNoiseBurst(
        lowFrequency: number,
        highFrequency: number,
        duration: number,
        peak: number,
        startTime: number,
        attack: number,
    ): void {
        if (!this.context || !this.masterGain || !this.noiseBuffer) {
            return;
        }
        const source = this.context.createBufferSource();
        const lowPass = this.context.createBiquadFilter();
        const highPass = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        source.buffer = this.noiseBuffer;
        lowPass.type = 'lowpass';
        lowPass.frequency.setValueAtTime(Math.max(lowFrequency, highFrequency), startTime);
        highPass.type = 'highpass';
        highPass.frequency.setValueAtTime(Math.min(lowFrequency, highFrequency), startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(duration * 0.35, attack));
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gain);
        gain.connect(this.masterGain);
        source.start(startTime);
        source.stop(startTime + duration);
        source.onended = () => {
            source.disconnect();
            highPass.disconnect();
            lowPass.disconnect();
            gain.disconnect();
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
