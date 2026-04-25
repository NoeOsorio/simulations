import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import './SimulationViewer.css';

interface Props {
  children: ReactNode;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

function isMobileLike(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const narrow = window.matchMedia('(max-width: 900px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return uaMobile || (narrow && coarse);
}

function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument;
  return (
    doc.fullscreenElement ??
    doc.webkitFullscreenElement ??
    doc.msFullscreenElement ??
    null
  );
}

export default function SimulationViewer({ children }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Phases haven't standardized on a single class — match the known
    // canvas-card wrappers across simulations.
    const found = host.querySelector<HTMLElement>(
      '.sim-viewport, .viewport-frame'
    );
    setTarget(found ?? null);
  }, [children]);

  useEffect(() => {
    const onChange = () => {
      const fs = getFullscreenElement();
      setIsFullscreen(!!fs && fs === target);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [target]);

  const enter = useCallback(async () => {
    const el = target as FullscreenElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) await el.msRequestFullscreen();

      if (isMobileLike()) {
        const orientation = window.screen?.orientation;
        if (orientation && typeof orientation.lock === 'function') {
          try {
            await orientation.lock('landscape');
          } catch {
            // Orientation lock isn't always permitted — ignore.
          }
        }
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, [target]);

  const exit = useCallback(async () => {
    const doc = document as FullscreenDocument;
    try {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      else if (doc.msExitFullscreen) await doc.msExitFullscreen();

      const orientation = window.screen?.orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch (err) {
      console.warn('Exit fullscreen failed:', err);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit();
    else enter();
  }, [isFullscreen, enter, exit]);

  const button = (
    <button
      type="button"
      className={`sim-viewer__fs-btn${isFullscreen ? ' sim-viewer__fs-btn--exit' : ''}`}
      onClick={toggle}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isFullscreen ? (
          <>
            <path d="M8 3v3a2 2 0 0 1-2 2H3" />
            <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
            <path d="M3 16h3a2 2 0 0 1 2 2v3" />
            <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
          </>
        ) : (
          <>
            <path d="M3 8V5a2 2 0 0 1 2-2h3" />
            <path d="M16 3h3a2 2 0 0 1 2 2v3" />
            <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
            <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          </>
        )}
      </svg>
      <span className="sim-viewer__fs-label">
        {isFullscreen ? 'Exit' : 'Fullscreen'}
      </span>
    </button>
  );

  return (
    <div ref={hostRef} className="sim-viewer">
      {children}
      {target && (isFullscreen ? createPortal(button, target) : button)}
    </div>
  );
}
