"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "audio-trimmer": dynamic(() => import("./audio-trimmer"), { loading: () => <ToolLoading /> }),
  "audio-merger": dynamic(() => import("./audio-merger"), { loading: () => <ToolLoading /> }),
  "audio-splitter": dynamic(() => import("./audio-splitter"), { loading: () => <ToolLoading /> }),
  "volume-changer-and-normalizer": dynamic(() => import("./volume-changer-and-normalizer"), { loading: () => <ToolLoading /> }),
  "audio-fade-in-out": dynamic(() => import("./audio-fade-in-out"), { loading: () => <ToolLoading /> }),
  "audio-speed-changer": dynamic(() => import("./audio-speed-changer"), { loading: () => <ToolLoading /> }),
  "audio-pitch-changer": dynamic(() => import("./audio-pitch-changer"), { loading: () => <ToolLoading /> }),
  "reverse-audio": dynamic(() => import("./reverse-audio"), { loading: () => <ToolLoading /> }),
  "silence-remover-and-detector": dynamic(() => import("./silence-remover-and-detector"), { loading: () => <ToolLoading /> }),
  "voice-recorder": dynamic(() => import("./voice-recorder"), { loading: () => <ToolLoading /> }),
  "audio-waveform-generator": dynamic(() => import("./audio-waveform-generator"), { loading: () => <ToolLoading /> }),
  "audio-spectrogram": dynamic(() => import("./audio-spectrogram"), { loading: () => <ToolLoading /> }),
  "audio-metadata-and-id3-tag-editor": dynamic(() => import("./audio-metadata-and-id3-tag-editor"), { loading: () => <ToolLoading /> }),
  "album-art-extractor": dynamic(() => import("./album-art-extractor"), { loading: () => <ToolLoading /> }),
  "audio-bitrate-and-file-size-calculator": dynamic(() => import("./audio-bitrate-and-file-size-calculator"), { loading: () => <ToolLoading /> }),
};
