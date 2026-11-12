// IMAGENS PARA COMPARTILHAR (draft e relatório da semana)
// Desenha um card 1080x1350 num <canvas> do próprio navegador e manda para o
// WhatsApp/Instagram pelo "Compartilhar" do celular (ou baixa no computador).
// As fotos passam pela rota /api/img (mesmo site), senão o navegador bloqueia
// transformar o canvas em imagem.

const W = 1080;
const H = 1350;
const BG = "#0b0e14";
const PANEL = "#151a24";
const LINE = "#262d3b";
const TEXT = "#f3f5f9";
const SOFT = "#9aa3b5";
const BLUE = "#2f6bff";
const GOOD = "#22c55e";
const BAD = "#ef4444";
const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** Endereço da foto pelo nosso site. */
export const brawlerImg = (id: number) => `/api/img?b=${id}`;
export const mapImg = (gameId: number) => `/api/img?m=${gameId}`;

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = TEXT, weight = 700, align: CanvasTextAlign = "left") {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}

/** Corta o texto com "…" se passar da largura. */
function fit(ctx: CanvasRenderingContext2D, s: string, max: number, size: number, weight = 700): string {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (ctx.measureText(s).width <= max) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + "…").width > max) out = out.slice(0, -1);
  return out + "…";
}

function base(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  return { canvas, ctx };
}

function logo(ctx: CanvasRenderingContext2D, subtitle: string) {
  round(ctx, 64, 60, 72, 72, 18);
  ctx.fillStyle = BLUE;
  ctx.fill();
  text(ctx, "BD", 100, 108, 32, "#fff", 800, "center");
  text(ctx, "BrawlDraft", 156, 96, 36, TEXT, 800);
  text(ctx, subtitle, 156, 128, 24, SOFT, 500);
}

function footer(ctx: CanvasRenderingContext2D, host: string) {
  text(ctx, host, W / 2, H - 52, 26, SOFT, 600, "center");
}

/** Ícone do Brawler num quadrado arredondado (ou as iniciais, se a foto falhar). */
function brawlerTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, x: number, y: number, size: number, border: string, dim = false) {
  ctx.save();
  round(ctx, x, y, size, size, size * 0.18);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.clip();
  if (dim) ctx.globalAlpha = 0.45;
  if (img) ctx.drawImage(img, x, y, size, size);
  else text(ctx, name.slice(0, 2).toUpperCase(), x + size / 2, y + size * 0.62, size * 0.36, SOFT, 800, "center");
  ctx.restore();
  ctx.lineWidth = Math.max(3, size * 0.03);
  ctx.strokeStyle = border;
  round(ctx, x, y, size, size, size * 0.18);
  ctx.stroke();
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      resolve(null);
    }
  });
}

export type DraftCardData = {
  title: string; // "Meu draft"
  mapName: string;
  modeLabel: string;
  modeColor: string;
  mapGameId: number;
  mine: { id: number; name: string }[];
  enemies: { id: number; name: string }[];
  bans: { id: number; name: string }[];
  myTeamLabel: string;
  enemyLabel: string;
  bansLabel: string;
  grade: string;
  chanceLabel: string; // "62% de chance de vencer"
  chance: number;
  host: string;
};

export async function draftCard(d: DraftCardData): Promise<Blob | null> {
  const { canvas, ctx } = base();
  const all = [...d.mine, ...d.enemies, ...d.bans];
  const [mapPic, ...pics] = await Promise.all([loadImg(mapImg(d.mapGameId)), ...all.map((b) => loadImg(brawlerImg(b.id)))]);
  const pic = new Map(all.map((b, i) => [b.id, pics[i]]));

  logo(ctx, d.title);

  // Mapa: foto à direita, nome e modo à esquerda.
  round(ctx, 64, 170, W - 128, 300, 28);
  ctx.fillStyle = PANEL;
  ctx.fill();
  if (mapPic) {
    const boxW = 300;
    const boxH = 260;
    const scale = Math.min(boxW / mapPic.width, boxH / mapPic.height);
    const w = mapPic.width * scale;
    const h = mapPic.height * scale;
    ctx.drawImage(mapPic, W - 84 - boxW + (boxW - w) / 2, 190 + (boxH - h) / 2, w, h);
  }
  ctx.fillStyle = d.modeColor;
  ctx.beginPath();
  ctx.arc(112, 262, 12, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, d.modeLabel, 136, 271, 30, SOFT, 600);
  text(ctx, fit(ctx, d.mapName, 560, 64, 800), 100, 360, 64, TEXT, 800);

  // Times
  const row = (label: string, list: { id: number; name: string }[], y: number, color: string) => {
    text(ctx, label.toUpperCase(), 64, y, 26, color, 800);
    const size = 200;
    const gap = (W - 128 - size * 3) / 2;
    list.forEach((b, i) => {
      const x = 64 + i * (size + gap);
      brawlerTile(ctx, pic.get(b.id) ?? null, b.name, x, y + 22, size, color);
      text(ctx, fit(ctx, b.name, size, 28, 700), x + size / 2, y + 22 + size + 40, 28, TEXT, 700, "center");
    });
  };
  row(d.myTeamLabel, d.mine, 520, BLUE);
  row(d.enemyLabel, d.enemies, 820, BAD);

  // Bans (pequenos) + nota
  const by = 1160;
  if (d.bans.length > 0) {
    text(ctx, d.bansLabel.toUpperCase(), 64, by, 22, SOFT, 800);
    d.bans.slice(0, 6).forEach((b, i) => brawlerTile(ctx, pic.get(b.id) ?? null, b.name, 64 + i * 76, by + 16, 64, LINE, true));
  }
  const gx = W - 64 - 420;
  round(ctx, gx, by - 34, 420, 140, 24);
  ctx.fillStyle = PANEL;
  ctx.fill();
  round(ctx, gx + 20, by - 14, 100, 100, 20);
  ctx.fillStyle = BLUE;
  ctx.fill();
  text(ctx, d.grade, gx + 70, by + 58, 60, "#fff", 800, "center");
  text(ctx, `${d.chance}%`, gx + 140, by + 34, 44, TEXT, 800);
  text(ctx, fit(ctx, d.chanceLabel, 260, 22, 500), gx + 140, by + 66, 20, SOFT, 500);

  footer(ctx, d.host);
  return toBlob(canvas);
}

export type WeekCardData = {
  title: string; // "Minha semana no Ranked"
  games: number;
  winRate: number;
  gamesLabel: string;
  winRateLabel: string;
  best?: { id: number; name: string; line: string };
  bestLabel: string;
  worstMap?: { name: string; line: string };
  worstLabel: string;
  days: { games: number; wins: number }[]; // últimos 7 dias, do mais antigo ao mais novo
  host: string;
};

export async function weekCard(d: WeekCardData): Promise<Blob | null> {
  const { canvas, ctx } = base();
  const bestPic = d.best ? await loadImg(brawlerImg(d.best.id)) : null;
  logo(ctx, d.title);

  // Dois números grandes
  const box = (x: number, label: string, value: string, color: string) => {
    round(ctx, x, 180, 460, 230, 28);
    ctx.fillStyle = PANEL;
    ctx.fill();
    text(ctx, label, x + 36, 240, 28, SOFT, 600);
    text(ctx, value, x + 36, 360, 110, color, 800);
  };
  box(64, d.gamesLabel, String(d.games), TEXT);
  box(W - 64 - 460, d.winRateLabel, `${d.winRate}%`, d.winRate >= 50 ? GOOD : BAD);

  // Barras dos 7 dias (vitórias em verde, derrotas em vermelho)
  round(ctx, 64, 440, W - 128, 340, 28);
  ctx.fillStyle = PANEL;
  ctx.fill();
  const max = Math.max(1, ...d.days.map((x) => x.games));
  const slot = (W - 128 - 80) / d.days.length;
  d.days.forEach((day, i) => {
    const x = 104 + i * slot + slot * 0.2;
    const bw = slot * 0.6;
    const full = 240;
    const hWins = (day.wins / max) * full;
    const hLoss = ((day.games - day.wins) / max) * full;
    const bottom = 740;
    ctx.fillStyle = GOOD;
    if (hWins > 0) {
      round(ctx, x, bottom - hWins, bw, hWins, 8);
      ctx.fill();
    }
    ctx.fillStyle = BAD;
    if (hLoss > 0) {
      round(ctx, x, bottom - hWins - hLoss - (hWins > 0 ? 6 : 0), bw, hLoss, 8);
      ctx.fill();
    }
    if (day.games === 0) {
      ctx.fillStyle = LINE;
      round(ctx, x, bottom - 6, bw, 6, 3);
      ctx.fill();
    }
  });

  // Melhor Brawler e pior mapa
  let y = 820;
  if (d.best) {
    round(ctx, 64, y, W - 128, 180, 28);
    ctx.fillStyle = PANEL;
    ctx.fill();
    brawlerTile(ctx, bestPic, d.best.name, 94, y + 25, 130, BLUE);
    text(ctx, d.bestLabel, 260, y + 70, 26, SOFT, 600);
    text(ctx, fit(ctx, d.best.name, 700, 52, 800), 260, y + 130, 52, TEXT, 800);
    text(ctx, fit(ctx, d.best.line, 260, 26, 600), W - 100, y + 130, 26, SOFT, 700, "right");
    y += 210;
  }
  if (d.worstMap) {
    round(ctx, 64, y, W - 128, 140, 28);
    ctx.fillStyle = PANEL;
    ctx.fill();
    text(ctx, d.worstLabel, 100, y + 56, 26, SOFT, 600);
    text(ctx, fit(ctx, d.worstMap.name, 600, 40, 800), 100, y + 108, 40, TEXT, 800);
    text(ctx, fit(ctx, d.worstMap.line, 280, 26, 600), W - 100, y + 108, 26, SOFT, 700, "right");
  }

  footer(ctx, d.host);
  return toBlob(canvas);
}

/** Abre o "Compartilhar" do celular; se não der, baixa a imagem. */
export async function shareImage(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
