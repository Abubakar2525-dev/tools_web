"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { ToolLoading } from "../loading";


export const components: Record<string, ComponentType> = {
  "password-generator": dynamic(() => import("./password-generator"), { loading: () => <ToolLoading /> }),
  "passphrase-generator": dynamic(() => import("./passphrase-generator"), { loading: () => <ToolLoading /> }),
  "pin-generator": dynamic(() => import("./pin-generator"), { loading: () => <ToolLoading /> }),
  "password-strength-checker": dynamic(() => import("./password-strength-checker"), { loading: () => <ToolLoading /> }),
  "random-string-and-secret-key-generator": dynamic(() => import("./random-string-and-secret-key-generator"), { loading: () => <ToolLoading /> }),
  "2fa-totp-code-generator": dynamic(() => import("./2fa-totp-code-generator"), { loading: () => <ToolLoading /> }),
  "hash-generator": dynamic(() => import("./hash-generator"), { loading: () => <ToolLoading /> }),
  "file-checksum-calculator-and-verifier": dynamic(() => import("./file-checksum-calculator-and-verifier"), { loading: () => <ToolLoading /> }),
  "text-encryption-decryption": dynamic(() => import("./text-encryption-decryption"), { loading: () => <ToolLoading /> }),
  "file-encryption-decryption": dynamic(() => import("./file-encryption-decryption"), { loading: () => <ToolLoading /> }),
  "zip-creator": dynamic(() => import("./zip-creator"), { loading: () => <ToolLoading /> }),
  "archive-extractor": dynamic(() => import("./archive-extractor"), { loading: () => <ToolLoading /> }),
  "tar-creator": dynamic(() => import("./tar-creator"), { loading: () => <ToolLoading /> }),
  "gzip-compressor": dynamic(() => import("./gzip-compressor"), { loading: () => <ToolLoading /> }),
  "batch-file-renamer": dynamic(() => import("./batch-file-renamer"), { loading: () => <ToolLoading /> }),
  "filename-cleaner": dynamic(() => import("./filename-cleaner"), { loading: () => <ToolLoading /> }),
  "duplicate-file-finder": dynamic(() => import("./duplicate-file-finder"), { loading: () => <ToolLoading /> }),
  "file-comparison": dynamic(() => import("./file-comparison"), { loading: () => <ToolLoading /> }),
  "file-type-and-mime-detector": dynamic(() => import("./file-type-and-mime-detector"), { loading: () => <ToolLoading /> }),
  "file-metadata-viewer-and-remover": dynamic(() => import("./file-metadata-viewer-and-remover"), { loading: () => <ToolLoading /> }),
};
