import type { CSSProperties } from "react";
import type { WidgetOptions } from "@metanoialabs/widget";
export type OmniChatbotProps = WidgetOptions & { className?: string; style?: CSSProperties };
export type OmniChatbotHandle = { send(text: string): boolean; open(): void; close(): void };
export declare const OmniChatbot: import("react").ForwardRefExoticComponent<OmniChatbotProps & import("react").RefAttributes<OmniChatbotHandle>>;
