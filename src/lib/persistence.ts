/**
 * Browser-side text persistence shared by every simulation.
 *
 * - downloadText: trigger a .txt download from a string
 * - pickTextFile : open the OS file picker and read the chosen file as text
 * - timestamp    : ISO-like local timestamp safe for filenames
 */

export function timestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function pickTextFile(accept = '.txt,.json,.log,text/plain,application/json'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      if (input.parentNode) input.parentNode.removeChild(input);
      resolve(val);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      try {
        const text = await file.text();
        finish(text);
      } catch {
        finish(null);
      }
    };

    // The browser does not fire any event when the picker is cancelled, so
    // we rely on `focus` returning to the window to clean up.
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(null), 500),
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}

/** Build a plain-text log file from an array of {t, msg} entries (newest first). */
export function logsToText(
  header: string,
  entries: ReadonlyArray<{ t: number; msg: string }>
): string {
  const lines = [
    `# ${header}`,
    `# exported: ${new Date().toISOString()}`,
    `# entries: ${entries.length}`,
    '',
    ...[...entries]
      .sort((a, b) => a.t - b.t)
      .map((e) => `[${new Date(e.t).toISOString()}] ${e.msg}`),
  ];
  return lines.join('\n') + '\n';
}

/**
 * Save state is a human-readable JSON wrapped with a single comment line.
 * The comment line is a `#`-prefixed header so users can see what the file
 * is when they open it; the rest is parseable JSON.
 */
export function stateToText(label: string, state: unknown): string {
  const header = `# sim-world state · ${label} · ${new Date().toISOString()}`;
  return `${header}\n${JSON.stringify(state, null, 2)}\n`;
}

export function parseStateText<T>(text: string): T {
  const trimmed = text.replace(/^#[^\n]*\n/, '').trim();
  return JSON.parse(trimmed) as T;
}
