import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { mount } from "@metanoialabs/widget";

export const OmniChatbot = forwardRef(function OmniChatbot(props, ref) {
  const host = useRef(null);
  const widget = useRef(null);
  const previousOptions = useRef(null);
  const { className, style, ...options } = props;
  // A ref gives the host page send(text) (post a message as the user, e.g. after a step the host ran), open() and close().
  useImperativeHandle(ref, () => ({
    send: text => widget.current?.send(text) ?? false,
    open: () => widget.current?.open(),
    close: () => widget.current?.close()
  }), []);
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
});
