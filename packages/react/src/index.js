import { createElement, useEffect, useRef } from "react";
import { mount } from "@metanoia/widget";

export function OmniChatbot(props) {
  const host = useRef(null);
  const widget = useRef(null);
  const previousOptions = useRef(null);
  const { className, style, ...options } = props;
  useEffect(() => {
    if (!host.current) return undefined;
    const instance = mount(host.current, options);
    widget.current = instance;
    previousOptions.current = options;
    return () => {
      instance.destroy();
      if (widget.current === instance) widget.current = null;
    };
  }, [options.endpoint]);
  useEffect(() => {
    const previous = previousOptions.current;
    const keys = new Set([...Object.keys(previous ?? {}), ...Object.keys(options)]);
    if (previous && [...keys].every(key => previous[key] === options[key])) return;
    const next = Object.fromEntries([...keys].map(key => [key, options[key]]));
    widget.current?.update(next);
    previousOptions.current = options;
  });
  return createElement("div", { ref: host, className, style });
}
