"use client";

import { useMemo } from "react";
import { PrivacyNote, ToolPanel } from "@/components/tools/kit";
import { baseName } from "@/components/tools/engines/files";
import { reversePcm } from "./lib/pcm";
import { AudioFileInput, useAudioFile } from "./shared/useAudioFile";
import { Waveform } from "./shared/Waveform";
import { AudioResult } from "./shared/Export";

export default function Tool() {
  const src = useAudioFile();
  const audio = src.audio;
  const reversed = useMemo(() => (audio ? reversePcm(audio.pcm) : null), [audio]);

  return (
    <div className="space-y-5">
      <ToolPanel title="Reverse audio">
        <AudioFileInput state={src.state} onFile={src.load} onClear={src.clear} />
        {audio && reversed && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Original</p>
              <Waveform pcm={audio.pcm} label={`Original waveform of ${audio.file.name}`} height={90} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Reversed</p>
              <Waveform pcm={reversed} label="Reversed waveform" height={90} />
            </div>
          </div>
        )}
        <div className="mt-6">
          <PrivacyNote />
        </div>
      </ToolPanel>
      {audio && reversed && (
        <ToolPanel>
          <AudioResult pcm={reversed} fileName={`${baseName(audio.file.name)}-reversed`} title="Reversed audio" />
        </ToolPanel>
      )}
    </div>
  );
}
