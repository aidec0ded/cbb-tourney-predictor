import { useState, useRef, useEffect } from 'react';

interface Props {
  text: string;
  children: React.ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const triggerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // If too close to top of viewport, show below
      setPosition(rect.top < 80 ? 'bottom' : 'top');
    }
  }, [show]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={`absolute z-50 px-2.5 py-1.5 text-[11px] leading-snug text-gray-200 bg-gray-800 border border-gray-700 rounded-md shadow-lg max-w-xs whitespace-normal ${
            position === 'top'
              ? 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'
              : 'top-full mt-1.5 left-1/2 -translate-x-1/2'
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
