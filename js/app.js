/* ========================================
   卒業アルバム — app.js
   "Terminal × Scrapbook" Hybrid
   狩野ゼミ HuntField / 2年制 / class of 2026
   ======================================== */
(function () {
  "use strict";

  /* ── CONFIG ── */
  const CFG = {
    CANVAS_W_MM: 440,
    CANVAS_H_MM: 298,
    DPI: 350,
    EXPORT_W: Math.round((440 / 25.4) * 350), // 6063px
    EXPORT_H: Math.round((298 / 25.4) * 350), // 4106px
    DISPLAY_W: 1100,
    JPEG_Q: 0.95,
    SCALE: function () {
      return this.EXPORT_W / this.DISPLAY_W;
    },
    PHOTO_MIN: 10,
    PHOTO_MAX: 30,
  };

  /* Display-P3 広色域サポート検出
     iPhone 7+, Galaxy S21+, Pixel 7+ 等のP3写真の色を保持するため */
  const P3_SUPPORTED = (() => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d", { colorSpace: "display-p3" });
      return !!(
        ctx &&
        ctx.getContextAttributes &&
        ctx.getContextAttributes().colorSpace === "display-p3"
      );
    } catch (e) {
      return false;
    }
  })();

  let layoutIndex = 0;
  let photoCount = 15; // 現在の写真枚数（10〜30）
  /* ════════════════════════════════════════
     動的レイアウト生成 — generateLayout(count, styleIndex)
     枚数に応じた均一サイズ配置 × 3スタイル
     ════════════════════════════════════════ */

  const STYLE_NAMES = [
    "layout_A // editorial",
    "layout_B // scattered",
    "layout_C // tech_grid",
  ];

  /* フレーム種の重み付きランダム選択（terminal以外） */
  const FRAME_WEIGHTS_NO_TERM = {
    0: ["polaroid","polaroid","tape","shadow"],
    1: ["polaroid","tape","tape","shadow","shadow"],
    2: ["shadow","shadow","polaroid","tape"],
  };

  const TAPE_COLORS = [
    "rgba(0,200,170,0.55)",
    "rgba(255,77,120,0.5)",
    "rgba(139,92,246,0.58)",
    "rgba(34,197,94,0.52)",
    "rgba(245,200,0,0.5)",
  ];

  /**
   * generateLayout(count, styleIndex)
   * @param {number} count      写真枚数 (10〜30)
   * @param {number} styleIndex スタイル番号 (0,1,2)
   * @returns {{ name:string, slots:Array }}
   */
  function generateLayout(count, styleIndex) {
    /* シード付き疑似乱数 — 同じ count+style なら同じ配置 */
    let _seed = count * 1000 + styleIndex * 137 + 42;
    function rand() {
      _seed = (_seed * 16807 + 0) % 2147483647;
      return (_seed & 0x7fffffff) / 0x7fffffff;
    }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    /* サイズ決定（枚数ティア・均一サイズ） */
    let sw, sh;
    if (count <= 12)      { sw = 20; sh = 20; }
    else if (count <= 16) { sw = 17; sh = 17; }
    else if (count <= 20) { sw = 14; sh = 14; }
    else if (count <= 24) { sw = 12; sh = 12; }
    else                  { sw = 10; sh = 10; }

    /* 左右ページに分配 */
    const leftCount  = Math.ceil(count / 2);
    const rightCount = count - leftCount;

    /* 行数を枚数に応じて動的に決定 */
    const ROW_COUNT = count <= 18 ? 3 : 4;

    /* 動的行数に対応した分配 */
    function distributeToRows(n) {
      const base = Math.floor(n / ROW_COUNT);
      const rem  = n % ROW_COUNT;
      return Array.from({ length: ROW_COUNT }, (_, i) => base + (i < rem ? 1 : 0));
    }

    /* ゾーン定義（行数に応じて動的生成） */
    function makeRowZones(nRows) {
      const usableTop = 5;
      const usableBot = 92;
      const totalH = usableBot - usableTop;
      const rowH = totalH / nRows;
      const zones = [];
      for (let i = 0; i < nRows; i++) {
        zones.push({
          tMin: usableTop + rowH * i,
          tMax: usableTop + rowH * (i + 1) - 2,
        });
      }
      return zones;
    }
    const ROW_ZONES = makeRowZones(ROW_COUNT);
    const COL_ZONES = {
      left:  { lMin: 1,  lMax: 44 },
      right: { lMin: 54, lMax: 97 },
    };

    /* スタイル別回転角の最大値 */
    const ROT_MAX = [3.5, 8, 1.5][styleIndex];

    const slots = [];
    let slotId = 1;

    /* ── terminalフレーム割り当て: 全体の30%を事前決定 ── */
    const termCount = Math.round(count * 0.3);
    const allIds = Array.from({ length: count }, (_, i) => i + 1);
    // シード乱数で決定的にシャッフルしてtermCount個を選出
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    const terminalSet = new Set(allIds.slice(0, termCount));

    function generatePage(pageCount, colZone) {
      const rowCounts = distributeToRows(pageCount);

      rowCounts.forEach((nInRow, ri) => {
        if (nInRow === 0) return;
        const zone = ROW_ZONES[ri];
        const availW = colZone.lMax - colZone.lMin - sw;

        for (let ci = 0; ci < nInRow; ci++) {
          /* 列内で均等に配置 */
          const spacing = nInRow > 1 ? availW / (nInRow - 1) : availW / 2;
          let l = colZone.lMin + spacing * ci;

          /* ジッター */
          l = Math.max(colZone.lMin, Math.min(colZone.lMax - sw, l + (rand() - 0.5) * 3));
          const tRange = zone.tMax - zone.tMin - sh;
          let t = zone.tMin + (tRange > 0 ? rand() * tRange : 0) + (rand() - 0.5) * 3;
          t = Math.max(zone.tMin, Math.min(zone.tMax - sh, t));

          /* 回転角 */
          const r = parseFloat(((rand() - 0.5) * 2 * ROT_MAX).toFixed(1));

          /* フレーム種: terminalSetに含まれるIDは terminal、それ以外はランダム */
          const f = terminalSet.has(slotId) ? "terminal" : pick(FRAME_WEIGHTS_NO_TERM[styleIndex]);

          const slot = {
            id: slotId++,
            l: parseFloat(l.toFixed(1)),
            t: parseFloat(t.toFixed(1)),
            w: sw, h: sh,
            r: r,
            z: 10 + Math.floor(rand() * 6),
            f: f,
          };

          if (f === "tape") {
            slot.tc = pick(TAPE_COLORS);
            slot.tr = parseFloat(((rand() - 0.5) * 6).toFixed(1));
          }
          if (f === "terminal") {
            slot.maxBot = zone.tMax + 5;
          }

          slots.push(slot);
        }
      });
    }

    generatePage(leftCount,  COL_ZONES.left);
    generatePage(rightCount, COL_ZONES.right);

    return { name: STYLE_NAMES[styleIndex], slots: slots };
  }

  /* 現在のレイアウトキャッシュ */
  let currentLayout = generateLayout(photoCount, layoutIndex);

  /* ════════════════════════════════════════
     DECORATIONS
     ════════════════════════════════════════ */
  const DECORATIONS = [
    /* ウォーターマーク */
    {
      type: "watermark",
      text: "2026",
      x: 32,
      y: 52,
      size: 148,
      color: "rgba(0,200,170,0.04)",
      rotation: -12,
      family: "Orbitron,sans-serif",
      z: 2,
    },
    {
      type: "watermark",
      text: "CLASS",
      x: 55,
      y: 78,
      size: 88,
      color: "rgba(245,200,0,0.03)",
      rotation: 0,
      family: "Orbitron,sans-serif",
      z: 2,
    },

    /* 背景ライン */
    { type: "line", x: 0, y: 29, w: 14, color: "rgba(0,200,170,0.22)", z: 3 },
    { type: "line", x: 87, y: 70, w: 10, color: "rgba(245,200,0,0.28)", z: 3 },
    { type: "line", x: 38, y: 94, w: 20, color: "rgba(255,77,120,0.2)", z: 3 },

    /* ターミナルBOX */
    {
      type: "terminal-box",
      lines: [
        { cls: "t-prompt", text: "$ git log --oneline -3" },
        { cls: "t-output", text: "a1b2c3 feat: 最高の思い出" },
        { cls: "t-output", text: "4d5e6f fix: 泣きながら提出" },
        { cls: "t-comment", text: "# HuntField class of 2026 🎓" },
      ],
      x: 0.8,
      y: 87.5,
      z: 120,
    },
    {
      type: "terminal-box",
      lines: [
        { cls: "t-prompt", text: "$ npm run graduate" },
        { cls: "t-output", text: "✓ memories: 1000+" },
        { cls: "t-output", text: "✓ friends: ∞" },
        { cls: "t-comment", text: "# 狩野ゼミ 卒業おめでとう!" },
      ],
      x: 72,
      y: 87,
      z: 120,
    },

    /* スティッキーノート */
    {
      type: "sticky",
      text: "プログラミング\nできるように\nなったよ！",
      x: 85.5,
      y: 7,
      rotation: 3,
      bg: "rgba(255,235,80,0.88)",
      size: 11,
      z: 130,
    },
    {
      type: "sticky",
      text: "深夜の\nコーディング\nなつかしい…",
      x: 0.5,
      y: 55,
      rotation: -4,
      bg: "rgba(0,200,170,0.25)",
      size: 10,
      z: 130,
    },

    /* コードスニペットステッカー */
    {
      type: "sticker",
      text: "</> 卒業",
      x: 43,
      y: 91,
      rotation: -2.5,
      bg: "rgba(0,200,170,0.18)",
      color: "#006655",
      size: 12,
      px: 8,
      py: 4,
      family: "Fira Code,monospace",
      z: 125,
    },
    {
      type: "sticker",
      text: "git push 青春",
      x: 52,
      y: 5,
      rotation: 3,
      bg: "rgba(59,130,246,0.18)",
      color: "#1a3a7a",
      size: 11,
      px: 7,
      py: 4,
      family: "Fira Code,monospace",
      z: 125,
    },
    {
      type: "sticker",
      text: "Hello World! 🌸",
      x: 20,
      y: 92.5,
      rotation: 1.5,
      bg: "rgba(255,77,120,0.2)",
      color: "#8a002a",
      size: 12,
      px: 8,
      py: 5,
      family: "Caveat,cursive",
      z: 125,
    },
    {
      type: "sticker",
      text: 'print("ありがとう")',
      x: 62.5,
      y: 90.5,
      rotation: -3,
      bg: "rgba(245,200,0,0.22)",
      color: "#7a6000",
      size: 10,
      px: 7,
      py: 4,
      family: "Fira Code,monospace",
      z: 125,
    },

    /* バブル */
    {
      type: "bubble",
      text: "最高！",
      x: 89,
      y: 49.5,
      rotation: -4,
      bg: "rgba(255,77,120,0.25)",
      color: "#900030",
      size: 13,
      px: 9,
      py: 5,
      family: "Caveat,cursive",
      z: 126,
    },
    {
      type: "bubble",
      text: "😎🎓",
      x: 96,
      y: 28,
      rotation: 5,
      bg: "rgba(245,200,0,0.3)",
      color: "#7a5500",
      size: 15,
      px: 7,
      py: 4,
      family: "Caveat,cursive",
      z: 126,
    },

    /* 絵文字 */
    {
      type: "emoji",
      text: "⭐",
      x: 46.5,
      y: 4.5,
      size: 18,
      rotation: 15,
      z: 128,
    },
    {
      type: "emoji",
      text: "✨",
      x: 92,
      y: 61,
      size: 16,
      rotation: -10,
      z: 128,
    },
    { type: "emoji", text: "🌸", x: 5, y: 92.5, size: 20, rotation: 5, z: 128 },
    {
      type: "emoji",
      text: "💻",
      x: 35.5,
      y: 93,
      size: 18,
      rotation: -5,
      z: 128,
    },
    { type: "emoji", text: "🎉", x: 75, y: 6, size: 18, rotation: 8, z: 128 },
  ];

  /* ════════════════════════════════════════
     EDITABLE TEXTS
     ゼミ名: 狩野ゼミ / HuntField / 2年制
     ════════════════════════════════════════ */
  const TEXTS = [
    {
      id: "txt-title",
      html: '<span style="color:#3b82f6;font-family:\'Fira Code\',monospace;font-size:12px;font-weight:400">&lt;</span><span style="color:#f472b6;font-weight:900">卒業</span><span style="color:#94a3b8;font-family:\'Fira Code\',monospace;font-size:12px;font-style:italic"> class=</span><span style="color:#fbbf24;font-weight:900">"2026"</span><span style="color:#3b82f6;font-family:\'Fira Code\',monospace;font-size:12px;font-weight:400">&gt;</span>',
      x: 4.5,
      y: 8.5,
      size: 19,
      family: "Zen Maru Gothic,sans-serif",
      color: "#f472b6",
      z: 140,
      bold: true,
    },
    {
      id: "txt-dept",
      text: "狩野ゼミ  HuntField",
      x: 4.5,
      y: 13.5,
      size: 14,
      family: "Zen Maru Gothic,sans-serif",
      color: "#7c3aed",
      z: 140,
    },
    {
      id: "txt-date",
      text: "$ 2026.03  2年制 卒業",
      x: 4.5,
      y: 17.5,
      size: 10,
      family: "Fira Code,monospace",
      color: "#059669",
      z: 140,
    },
    {
      id: "txt-msg",
      text: "最高の2年間、ありがとう 🌟",
      x: 28,
      y: 95,
      size: 14,
      family: "Caveat,cursive",
      color: "#6a2d48",
      z: 140,
    },
  ];

  /* ═══════════════ STATE ═══════════════ */
  const photos = {};
  let slotJitter = {}; // { slotId: {dl, dt, dr} } — シャッフル時の位置ジッター
  let slotOverrides = {}; // { slotId: { h: % } }     — アスペクト比調整後の高さ
  let zOverrides = {}; // { slotId: z }             — ユーザー操作でのz-index上書き
  let templateEl, fileInput, bulkInput;

  /* ─────────────────────────────────
     INIT
  ───────────────────────────────── */
  function init() {
    templateEl = document.getElementById("template");
    fileInput = document.getElementById("file-input");
    bulkInput = document.getElementById("bulk-input");

    document
      .getElementById("btn-bulk")
      .addEventListener("click", () => bulkInput.click());
    document
      .getElementById("btn-export")
      .addEventListener("click", exportTemplate);
    document.getElementById("btn-reset").addEventListener("click", resetAll);
    document
      .getElementById("btn-layout")
      .addEventListener("click", cycleLayout);
    document
      .getElementById("btn-count-minus")
      .addEventListener("click", () => changePhotoCount(-1));
    document
      .getElementById("btn-count-plus")
      .addEventListener("click", () => changePhotoCount(+1));

    bulkInput.addEventListener("change", handleBulkUpload);
    fileInput.addEventListener("change", handleSingleUpload);

    updateCountDisplay();
    buildCanvas();
  }

  /* ─────────────────────────────────
     CHANGE PHOTO COUNT
  ───────────────────────────────── */
  function changePhotoCount(delta) {
    const prev = photoCount;
    photoCount = Math.max(
      CFG.PHOTO_MIN,
      Math.min(CFG.PHOTO_MAX, photoCount + delta),
    );
    if (photoCount === prev) return;
    updateCountDisplay();
    slotJitter = {}; // 枚数変更時はジッターをクリア
    slotOverrides = {};
    zOverrides = {};
    currentLayout = generateLayout(photoCount, layoutIndex);
    const saved = Object.assign({}, photos);
    buildCanvas();
    Object.entries(saved).forEach(([id, url]) => {
      photos[id] = url;
      renderPhoto(Number(id), url);
    });
    notify(`写真枠: ${photoCount}枚`);
  }

  function updateCountDisplay() {
    const d = document.getElementById("count-display");
    if (d) d.textContent = photoCount + "枚";
  }

  /* ─────────────────────────────────
     BUILD CANVAS
  ───────────────────────────────── */
  function buildCanvas() {
    templateEl.innerHTML = "";

    /* ── ターミナルヘッダーバー ── */
    const hdr = el("div", { className: "canvas-header" });
    hdr.innerHTML = `
     <span class="ch-dots"><span class="ch-dot ch-dot-r"></span><span class="ch-dot ch-dot-y"></span><span class="ch-dot ch-dot-g"></span></span>
     <span class="ch-prompt">student@huntfield</span>
     <span class="ch-cmd">:~ $ open <em style="font-style:normal;color:var(--accent-yellow)">graduation_album.jpg</em></span>
     <span class="ch-comment"># 狩野ゼミ HuntField 2026</span>
     <a class="ch-gh-link" href="https://github.com/Tatuya312/HuntFieldGraduationAlbum" target="_blank" rel="noopener">⌥ github.com/Tatuya312/HuntFieldGraduationAlbum</a>
     <span class="ch-badge">350 dpi</span>`;
    templateEl.appendChild(hdr);

    /* ── 背景グリッド（エクスポート時非表示） ── */
    templateEl.appendChild(el("div", { className: "bg-grid" }));

    /* ── ビネット ── */
    templateEl.appendChild(el("div", { className: "vignette-overlay" }));

    /* ── コーナーブラケット ── */
    ["tl", "tr", "bl", "br"].forEach((pos) => {
      templateEl.appendChild(el("div", { className: `corner-bracket ${pos}` }));
    });

    /* ── レイアウトバッジ ── */
    const badge = el("div", { className: "layout-badge", id: "layout-badge" });
    badge.textContent = currentLayout.name;
    templateEl.appendChild(badge);

    /* ── 制作ルール: 断裁線ガイド（外枠3mm余白）── */
    templateEl.appendChild(el("div", { className: "safe-zone" }));

    /* ── 制作ルール: 折り目ガイド（縦中央）── */
    templateEl.appendChild(el("div", { className: "fold-line" }));

    /* ── 左右ページ背景（製本時の影効果） ── */
    templateEl.appendChild(el("div", { className: "page-bg page-bg-left" }));
    templateEl.appendChild(el("div", { className: "page-bg page-bg-right" }));

    /* ── ページラベル（編集ガイド、エクスポート時非表示） ── */
    const pgL = el("div", { className: "page-label page-label-left" });
    pgL.textContent = "P.01";
    templateEl.appendChild(pgL);
    const pgR = el("div", { className: "page-label page-label-right" });
    pgR.textContent = "P.02";
    templateEl.appendChild(pgR);

    /* ── 装飾 ── */
    DECORATIONS.forEach((d) => createDeco(d));

    /* ── ピン ── */
    createPins();

    /* ── フォトスロット（photoCount枚まで） ── */
    currentLayout.slots.forEach((s) => createSlot(s));

    /* ── 編集テキスト ── */
    TEXTS.forEach((t) => createText(t));
  }

  /* ─────────────────────────────────
     SHUFFLE — レイアウト切替 + 位置ジッター + 写真並び替え
  ───────────────────────────────── */

  function cycleLayout() {
    layoutIndex = (layoutIndex + 1) % STYLE_NAMES.length;

    // オーバーライドをすべてリセット（新レイアウトで仕切り直し）
    slotOverrides = {};
    zOverrides = {};

    // レイアウト再生成
    currentLayout = generateLayout(photoCount, layoutIndex);

    // ── 1. スロット位置ジッター生成 ──
    slotJitter = {};
    currentLayout.slots.forEach((s) => {
      slotJitter[s.id] = {
        dl: (Math.random() - 0.5) * 3.0,
        dt: (Math.random() - 0.5) * 2.5,
        dr: (Math.random() - 0.5) * 8.0,
      };
    });

    // ── 2. 写真割り当てシャッフル ──
    const occupiedIds = Object.keys(photos)
      .map(Number)
      .filter((id) => id <= photoCount);
    const photoUrls = occupiedIds.map((id) => photos[id]);
    for (let i = photoUrls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [photoUrls[i], photoUrls[j]] = [photoUrls[j], photoUrls[i]];
    }
    for (const k in photos) delete photos[k];
    occupiedIds.forEach((id, idx) => {
      photos[id] = photoUrls[idx];
    });

    // ── 3. キャンバス再構築 & 写真復元 ──
    buildCanvas();
    Object.entries(photos).forEach(([id, url]) => renderPhoto(Number(id), url));

    notify(`shuffle → ${currentLayout.name}`);
  }

  /* ─────────────────────────────────
     DECORATIONS
  ───────────────────────────────── */
  function createDeco(d) {
    let node;
    if (d.type === "watermark") {
      node = el("div", { className: "decoration deco-watermark" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        fontSize: d.size + "px",
        color: d.color,
        fontFamily: d.family,
        fontWeight: "900",
        transform: `rotate(${d.rotation}deg)`,
        letterSpacing: "8px",
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      });
      node.textContent = d.text;
    } else if (d.type === "line") {
      node = el("div", { className: "decoration deco-line" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        width: d.w + "%",
        background: d.color,
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        height: "3px",
        borderRadius: "2px",
      });
    } else if (d.type === "terminal-box") {
      node = el("div", { className: "decoration deco-terminal" });
      node.style.cssText = `left:${d.x}%;top:${d.y}%;z-index:${d.z};position:absolute;pointer-events:none;user-select:none;white-space:pre;`;
      node.innerHTML = d.lines
        .map((l) => `<span class="${l.cls}">${escHtml(l.text)}</span>`)
        .join("\n");
    } else if (d.type === "sticky") {
      node = el("div", { className: "decoration deco-sticky" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        fontSize: d.size + "px",
        background: d.bg,
        transform: `rotate(${d.rotation}deg)`,
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
      });
      node.textContent = d.text;
    } else if (d.type === "sticker") {
      node = el("div", { className: "decoration deco-sticker" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        fontSize: d.size + "px",
        background: d.bg,
        color: d.color,
        fontFamily: d.family,
        padding: `${d.py || 4}px ${d.px || 8}px`,
        borderRadius: "4px",
        transform: `rotate(${d.rotation}deg)`,
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      });
      node.textContent = d.text;
    } else if (d.type === "bubble") {
      node = el("div", { className: "decoration deco-bubble" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        fontSize: d.size + "px",
        background: d.bg,
        color: d.color,
        fontFamily: d.family,
        padding: `${d.py || 4}px ${d.px || 8}px`,
        borderRadius: "20px",
        transform: `rotate(${d.rotation}deg)`,
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      });
      node.textContent = d.text;
    } else if (d.type === "emoji") {
      node = el("div", { className: "decoration deco-emoji" });
      Object.assign(node.style, {
        left: d.x + "%",
        top: d.y + "%",
        fontSize: d.size + "px",
        transform: `rotate(${d.rotation || 0}deg)`,
        zIndex: d.z,
        position: "absolute",
        pointerEvents: "none",
        userSelect: "none",
      });
      node.textContent = d.text;
    }
    if (node) templateEl.appendChild(node);
  }

  /* ─────────────────────────────────
     PINS
  ───────────────────────────────── */
  function createPins() {
    [
      { x: 5, y: 6.5, c: "#ff5f57" },
      { x: 48.5, y: 6, c: "var(--accent-cyan)" },
      { x: 97, y: 6.5, c: "#febc2e" },
      { x: 5, y: 93.5, c: "var(--accent-purple)" },
      { x: 97, y: 93.5, c: "var(--accent-green)" },
    ].forEach((p) => {
      const pin = el("div", { className: "pin" });
      pin.style.cssText = `left:${p.x}%;top:${p.y}%;background:${p.c};`;
      templateEl.appendChild(pin);
    });
  }

  /* ─────────────────────────────────
     CREATE SLOT
  ───────────────────────────────── */
  function createSlot(s) {
    // ジッターを合成（シャッフル時のみ slotJitter に値が入る）
    const jt = slotJitter[s.id] || { dl: 0, dt: 0, dr: 0 };
    const baseL =
      slotOverrides[s.id]?.l !== undefined ? slotOverrides[s.id].l : s.l;
    const baseT =
      slotOverrides[s.id]?.t !== undefined ? slotOverrides[s.id].t : s.t;
    const finalL = baseL + jt.dl;
    const finalT = baseT + jt.dt;
    const finalR = s.r + jt.dr;
    const finalZ = zOverrides[s.id] !== undefined ? zOverrides[s.id] : s.z;
    const finalW =
      slotOverrides[s.id]?.w !== undefined ? slotOverrides[s.id].w : s.w;
    const finalH =
      slotOverrides[s.id]?.h !== undefined ? slotOverrides[s.id].h : s.h;

    const slot = el("div", {
      className: `photo-slot frame-${s.f}`,
      id: `slot-${s.id}`,
    });
    slot.style.cssText = `left:${finalL}%;top:${finalT}%;width:${finalW}%;height:${finalH}%;z-index:${finalZ};--rot:${finalR}deg;transform:rotate(${finalR}deg);`;

    if (s.f === "terminal") {
      const tab = el("div", { className: "terminal-tab" });
      tab.innerHTML = `<span class="t-dot t-dot-r"></span><span class="t-dot t-dot-y"></span><span class="t-dot t-dot-g"></span><span class="t-label">photo_${String(s.id).padStart(2, "0")}.jpg</span>`;
      slot.appendChild(tab);
    }
    if (s.f === "tape" && s.tc) {
      const tape = el("div", { className: "tape-strip" });
      Object.assign(tape.style, {
        background: s.tc,
        transform: `translateX(-50%) rotate(${s.tr || 0}deg)`,
      });
      slot.appendChild(tape);
    }

    const container = el("div", { className: "photo-container" });
    const ph = el("div", { className: "placeholder" });
    ph.innerHTML = `<div class="plus-icon">+</div><div class="slot-number">[ ${String(s.id).padStart(2, "0")} ]</div>`;
    container.appendChild(ph);
    slot.appendChild(container);

    const rm = el("div", { className: "remove-btn" });
    rm.innerHTML = "&times;";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      removePhoto(s.id);
    });
    slot.appendChild(rm);

    // z-order コントロール（前面 / 背面ボタン）
    const zCtrl = el("div", { className: "z-ctrl" });
    zCtrl.innerHTML =
      '<button class="z-up" title="前面へ">▲</button><button class="z-dn" title="背面へ">▼</button>';
    zCtrl.querySelector(".z-up").addEventListener("click", (e) => {
      e.stopPropagation();
      bringForward(s.id);
    });
    zCtrl.querySelector(".z-dn").addEventListener("click", (e) => {
      e.stopPropagation();
      sendBackward(s.id);
    });
    slot.appendChild(zCtrl);

    // ── 4隅リサイズハンドル ──
    ["tl", "tr", "bl", "br"].forEach((corner) => {
      const rh = el("div", { className: `resize-handle resize-${corner}` });
      rh.addEventListener("mousedown", (e) => initResize(s.id, e, corner));
      rh.addEventListener("click", (e) => e.stopPropagation());
      slot.appendChild(rh);
    });

    // 移動ハンドル（視覚アフォーダンス用、スロット本体のドラッグでも移動可能）
    const mh = el("div", { className: "move-handle" });
    mh.title = "ドラッグで位置移動";
    mh.innerHTML = "✥";
    mh.addEventListener("mousedown", (e) => initDrag(s.id, e));
    mh.addEventListener("click", (e) => e.stopPropagation());
    slot.appendChild(mh);

    // ── スロット本体のインタラクション ──
    // スクロールで前後関係変更
    slot.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) bringForward(s.id);
        else sendBackward(s.id);
      },
      { passive: false },
    );

    // スロット本体をドラッグして移動（ボタン・ハンドル以外の部分）
    let _slotDragged = false;
    slot.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (
        e.target.closest(".remove-btn, .z-ctrl, .resize-handle, .move-handle")
      )
        return;
      _slotDragged = false;
      initDrag(s.id, e, () => {
        _slotDragged = true;
      });
    });

    slot.addEventListener("click", (e) => {
      if (_slotDragged) {
        _slotDragged = false;
        return;
      }
      if (!photos[s.id]) openFilePicker(s.id);
    });

    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("drag-over");
    });
    slot.addEventListener("dragleave", () =>
      slot.classList.remove("drag-over"),
    );
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) loadPhoto(s.id, f);
    });

    templateEl.appendChild(slot);
    if (photos[s.id]) renderPhoto(s.id, photos[s.id]);
  }

  /* ─────────────────────────────────
     EDITABLE TEXT
  ───────────────────────────────── */
  function createText(t) {
    const div = el("div", {
      className: "editable-text",
      id: t.id,
      contentEditable: "true",
    });
    Object.assign(div.style, {
      left: t.x + "%",
      top: t.y + "%",
      fontSize: t.size + "px",
      fontFamily: t.family,
      color: t.color,
      fontWeight: t.bold ? "900" : "700",
      zIndex: t.z,
    });
    if (t.html) div.innerHTML = t.html;
    else div.textContent = t.text || "";

    // ── カラーピッカーツールバー ──
    const toolbar = el("div", {
      className: "text-toolbar",
      contentEditable: "false",
    });
    const PRESETS = [
      "#00c8aa",
      "#ff4d78",
      "#f5c800",
      "#3b82f6",
      "#8b5cf6",
      "#22c55e",
      "#cc3377",
      "#cc8800",
      "#007744",
      "#884466",
      "#1a1a2e",
      "#ffffff",
    ];
    PRESETS.forEach((color) => {
      const sw = el("span", { className: "tc-swatch", title: color });
      sw.style.background = color;
      sw.addEventListener("mousedown", (e) => {
        e.preventDefault(); // contentEditable のフォーカスを保持
        div.style.color = color;
        ci.value = color;
      });
      toolbar.appendChild(sw);
    });
    // カスタムカラー入力
    const sep = el("span", { className: "tc-divider" });
    toolbar.appendChild(sep);
    const ci = el("input");
    ci.type = "color";
    ci.className = "tc-input";
    ci.title = "カスタムカラー";
    ci.value = /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#cccccc";
    ci.addEventListener("input", (e) => {
      div.style.color = e.target.value;
    });
    toolbar.appendChild(ci);

    div.appendChild(toolbar);
    templateEl.appendChild(div);
  }

  /* ─────────────────────────────────
     PHOTO HANDLING
  ───────────────────────────────── */
  let pendingSlotId = null;

  function openFilePicker(id) {
    pendingSlotId = id;
    fileInput.value = "";
    fileInput.click();
  }

  function handleSingleUpload(e) {
    const f = e.target.files[0];
    if (f && pendingSlotId !== null) loadPhoto(pendingSlotId, f);
  }

  function handleBulkUpload(e) {
    const files = Array.from(e.target.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    const empties = currentLayout.slots
      .filter((s) => !photos[s.id])
      .map((s) => s.id);
    files.slice(0, empties.length).forEach((f, i) => loadPhoto(empties[i], f));
    if (files.length > empties.length)
      notify(`${empties.length}枚配置（空きスロット数）`);
  }

  function loadPhoto(id, file) {
    /* createImageBitmap は EXIF orientation を正しく適用し、
       回転済みのピクセルデータを返す。これにより coverCropForExport で
       drawImage の EXIF 二重適用による 90° 回転を防止する。 */
    createImageBitmap(file).then((bitmap) => {
      const cvs = document.createElement("canvas");
      cvs.width = bitmap.width;
      cvs.height = bitmap.height;
      const ctx = cvs.getContext(
        "2d",
        P3_SUPPORTED ? { colorSpace: "display-p3" } : undefined,
      );
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const url = cvs.toDataURL("image/jpeg", 0.97);
      photos[id] = url;
      renderPhoto(id, url);
    });
  }

  function renderPhoto(id, url) {
    const slot = document.getElementById(`slot-${id}`);
    if (!slot) return;
    const container = slot.querySelector(".photo-container");
    if (!container) return;
    container.innerHTML = "";
    const img = el("img");
    img.alt = `写真 ${id}`;

    img.onload = () => {
      const slotDef = currentLayout.slots.find((s) => s.id === id);
      if (!slotDef) return;

      // アスペクト比に合わせてスロット高さを自動調整（手動リサイズ済みならスキップ）
      if (!slotOverrides[id]?.manual) {
        const canvasW = CFG.DISPLAY_W;
        const canvasH = Math.round(canvasW / (440 / 298));
        const curW = slotOverrides[id]?.w ?? slotDef.w;
        const slotWpx = (curW / 100) * canvasW;
        const imgAspect = img.naturalHeight / img.naturalWidth;
        let newH = ((slotWpx * imgAspect) / canvasH) * 100;

        // ゾーン境界を使って高さを制約（maxBotがあればそれを使う、なければ±10%）
        const curT = slotOverrides[id]?.t ?? slotDef.t;
        if (slotDef.maxBot) {
          const maxH = slotDef.maxBot - curT;
          const minH = slotDef.h * 0.45;
          newH = Math.max(minH, Math.min(maxH, newH));
        } else {
          // アクセント枠（maxBotなし）— 小枠なので控えめに ±30%
          newH = Math.max(slotDef.h * 0.7, Math.min(slotDef.h * 1.3, newH));
        }

        if (Math.abs(newH - (slotOverrides[id]?.h ?? slotDef.h)) > 0.3) {
          slotOverrides[id] = slotOverrides[id] || {};
          slotOverrides[id].h = newH;
          slot.style.height = newH + "%";
        }
      }
    };

    container.appendChild(img);
    img.src = url;
    slot.classList.add("has-photo");
    if (!slot.querySelector(".remove-btn")) {
      const rb = el("div", { className: "remove-btn" });
      rb.innerHTML = "&times;";
      rb.addEventListener("click", (ev) => {
        ev.stopPropagation();
        removePhoto(id);
      });
      slot.appendChild(rb);
    }
  }

  /* ─────────────────────────────────
     EXPORT用 object-fit:cover 手動変換
     html2canvas は object-fit を正しく扱えないため、エクスポート直前に
     各写真を <canvas> 要素で cover クロップし、<img> と差し替える。
     <canvas> は html2canvas がネイティブにピクセルコピーするため
     object-fit 問題と非同期ロード問題を完全に回避できる。
  ───────────────────────────────── */
  let _exportBackup = []; // [{container, origImg}]

  function coverCropForExport() {
    _exportBackup = [];
    const scale = CFG.SCALE(); // ≈ 5.51

    document
      .querySelectorAll(".photo-slot.has-photo .photo-container")
      .forEach((container) => {
        const img = container.querySelector("img");
        if (!img || !img.naturalWidth) return;

        // コンテナの CSS ピクセル寸法（padding 等を除いた実表示サイズ）
        const cW = container.offsetWidth;
        const cH = container.offsetHeight;
        if (!cW || !cH) return;

        const nW = img.naturalWidth;
        const nH = img.naturalHeight;
        const imgR = nW / nH;
        const cR = cW / cH;

        // cover 相当のソース矩形を算出
        let sx, sy, sw, sh;
        if (imgR > cR) {
          sh = nH;
          sw = Math.round(nH * cR);
          sx = Math.round((nW - sw) / 2);
          sy = 0;
        } else {
          sw = nW;
          sh = Math.round(nW / cR);
          sx = 0;
          sy = Math.round((nH - sh) / 2);
        }

        // エクスポート解像度で <canvas> を生成（高解像度維持）
        const outW = Math.round(cW * scale);
        const outH = Math.round(cH * scale);
        const cvs = document.createElement("canvas");
        cvs.width = outW;
        cvs.height = outH;
        cvs.style.cssText = "width:100%;height:100%;display:block;";
        // P3写真の広色域データを保持してクロップ
        const ctx = cvs.getContext(
          "2d",
          P3_SUPPORTED ? { colorSpace: "display-p3" } : undefined,
        );
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

        // <img> → <canvas> に差し替え
        _exportBackup.push({ container, origImg: img });
        container.replaceChild(cvs, img);
      });
  }

  function restoreAfterExport() {
    _exportBackup.forEach(({ container, origImg }) => {
      const cvs = container.querySelector("canvas");
      if (cvs) container.replaceChild(origImg, cvs);
    });
    _exportBackup = [];
  }

  /* スロットの手動位置移動 */
  // onDragStart: 最初に閾値(3px)を超えて動いた際に呼ばれるコールバック
  function initDrag(slotId, startEvt, onDragStart) {
    startEvt.preventDefault();
    startEvt.stopPropagation();
    const slot = document.getElementById(`slot-${slotId}`);
    if (!slot) return;
    const canvasRect = templateEl.getBoundingClientRect();
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const startLPct = parseFloat(slot.style.left);
    const startTPct = parseFloat(slot.style.top);
    let dragStarted = false;

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // 3px以上動いた時点でドラッグ開始とみなす
      if (!dragStarted && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragStarted = true;
        if (onDragStart) onDragStart();
        slot.classList.add("dragging");
      }
      if (!dragStarted) return;
      const lPct = startLPct + (dx / canvasRect.width) * 100;
      const tPct = startTPct + (dy / canvasRect.height) * 100;

      slotOverrides[slotId] = slotOverrides[slotId] || {};
      slotOverrides[slotId].l = lPct;
      slotOverrides[slotId].t = tPct;

      slot.style.left = lPct + "%";
      slot.style.top = tPct + "%";
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      slot.classList.remove("dragging");
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /* スロットの手動リサイズ（4隅対応） */
  // corner: 'tl' | 'tr' | 'bl' | 'br'
  function initResize(slotId, startEvt, corner) {
    startEvt.preventDefault();
    startEvt.stopPropagation();
    const slot = document.getElementById(`slot-${slotId}`);
    if (!slot) return;
    const canvasRect = templateEl.getBoundingClientRect();
    const startX = startEvt.clientX;
    const startY = startEvt.clientY;
    const startWPct = parseFloat(slot.style.width);
    const startHPct = parseFloat(slot.style.height);
    const startLPct = parseFloat(slot.style.left);
    const startTPct = parseFloat(slot.style.top);

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dWPct = (dx / canvasRect.width) * 100;
      const dHPct = (dy / canvasRect.height) * 100;
      let wPct = startWPct,
        hPct = startHPct,
        lPct = startLPct,
        tPct = startTPct;

      if (corner === "br") {
        // 右辺・下辺が動く（左上固定）
        wPct = Math.max(3, startWPct + dWPct);
        hPct = Math.max(3, startHPct + dHPct);
      } else if (corner === "bl") {
        // 左辺・下辺が動く（右上固定）
        wPct = Math.max(3, startWPct - dWPct);
        hPct = Math.max(3, startHPct + dHPct);
        lPct = startLPct + (startWPct - wPct);
      } else if (corner === "tr") {
        // 右辺・上辺が動く（左下固定）
        wPct = Math.max(3, startWPct + dWPct);
        hPct = Math.max(3, startHPct - dHPct);
        tPct = startTPct + (startHPct - hPct);
      } else {
        // tl
        // 左辺・上辺が動く（右下固定）
        wPct = Math.max(3, startWPct - dWPct);
        hPct = Math.max(3, startHPct - dHPct);
        lPct = startLPct + (startWPct - wPct);
        tPct = startTPct + (startHPct - hPct);
      }

      slotOverrides[slotId] = slotOverrides[slotId] || {};
      slotOverrides[slotId].w = wPct;
      slotOverrides[slotId].h = hPct;
      slotOverrides[slotId].l = lPct;
      slotOverrides[slotId].t = tPct;
      slotOverrides[slotId].manual = true;

      slot.style.width = wPct + "%";
      slot.style.height = hPct + "%";
      slot.style.left = lPct + "%";
      slot.style.top = tPct + "%";
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      slot.classList.remove("resizing");
    }

    slot.classList.add("resizing");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function removePhoto(id) {
    delete photos[id];
    delete slotOverrides[id];
    const slot = document.getElementById(`slot-${id}`);
    if (!slot) return;
    slot.classList.remove("has-photo");
    // スロット高さをデフォルトに戻す
    const slotDef = currentLayout.slots.find((s) => s.id === id);
    if (slotDef) {
      slot.style.width = slotDef.w + "%";
      slot.style.height = slotDef.h + "%";
    }
    const container = slot.querySelector(".photo-container");
    if (container) {
      container.innerHTML = `<div class="placeholder"><div class="plus-icon">+</div><div class="slot-number">[ ${String(id).padStart(2, "0")} ]</div></div>`;
    }
  }

  /* ─────────────────────────────────
     Z-ORDER 操作
  ───────────────────────────────── */
  function _allSlots() {
    return currentLayout.slots;
  }

  function bringForward(id) {
    const maxZ = Math.max(
      ..._allSlots().map((s) =>
        zOverrides[s.id] !== undefined ? zOverrides[s.id] : s.z,
      ),
    );
    const newZ = maxZ + 1;
    zOverrides[id] = newZ;
    const slotEl = document.getElementById(`slot-${id}`);
    if (slotEl) slotEl.style.zIndex = newZ;
  }

  function sendBackward(id) {
    const minZ = Math.min(
      ..._allSlots().map((s) =>
        zOverrides[s.id] !== undefined ? zOverrides[s.id] : s.z,
      ),
    );
    const newZ = Math.max(1, minZ - 1);
    zOverrides[id] = newZ;
    const slotEl = document.getElementById(`slot-${id}`);
    if (slotEl) slotEl.style.zIndex = newZ;
  }

  /* ─────────────────────────────────
     RESET
  ───────────────────────────────── */
  function resetAll() {
    if (!confirm("すべての写真を削除してリセットしますか？")) return;
    for (const k in photos) delete photos[k];
    slotJitter = {};
    slotOverrides = {};
    zOverrides = {};
    buildCanvas();
    notify("リセット完了");
  }

  /* ─────────────────────────────────
     EXPORT
  ───────────────────────────────── */
  function exportTemplate() {
    document.querySelector(".export-overlay").classList.remove("hidden");
    templateEl.classList.add("exporting");
    const scale = CFG.SCALE();
    setTimeout(() => {
      /* ── P3 広色域: エクスポート中、全canvas生成をDisplay-P3に強制 ──
         html2canvas内部で生成されるcanvasも含め、写真のP3色データを
         パイプライン全体で保持する。非対応ブラウザでは何もしない。 */
      let _origGetCtx;
      if (P3_SUPPORTED) {
        _origGetCtx = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
          if (type === "2d")
            attrs = Object.assign({}, attrs, { colorSpace: "display-p3" });
          return _origGetCtx.call(this, type, attrs);
        };
      }

      // html2canvas用: object-fit:cover を手動クロップに変換
      coverCropForExport();
      html2canvas(templateEl, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#eee8d2",
        logging: false,
        imageTimeout: 20000,
        width: templateEl.offsetWidth,
        height: templateEl.offsetHeight,
      })
        .then((srcCanvas) => {
          // getContext monkey-patch を復元
          if (_origGetCtx) HTMLCanvasElement.prototype.getContext = _origGetCtx;

          // 正確なエクスポート寸法にリサイズ（丸め誤差によるアスペクト比ズレを防止）
          const finalCanvas = document.createElement("canvas");
          finalCanvas.width = CFG.EXPORT_W;
          finalCanvas.height = CFG.EXPORT_H;
          const fCtx = finalCanvas.getContext(
            "2d",
            P3_SUPPORTED ? { colorSpace: "display-p3" } : undefined,
          );
          fCtx.drawImage(srcCanvas, 0, 0, CFG.EXPORT_W, CFG.EXPORT_H);

          finalCanvas.toBlob(
            (blob) => {
              blob.arrayBuffer().then((buf) => {
                let patched = setJpegDPI(new Uint8Array(buf), 350);
                const iccProfile = P3_SUPPORTED
                  ? buildDisplayP3Profile()
                  : buildSRGBProfile();
                patched = embedICCProfile(patched, iccProfile);
                const url = URL.createObjectURL(
                  new Blob([patched], { type: "image/jpeg" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "graduation_album_huntfield_2026.jpg";
                a.click();
                URL.revokeObjectURL(url);
                restoreAfterExport();
                templateEl.classList.remove("exporting");
                document
                  .querySelector(".export-overlay")
                  .classList.add("hidden");
                notify(
                  P3_SUPPORTED
                    ? "エクスポート完了 (Display-P3) 🎉"
                    : "エクスポート完了 (sRGB) 🎉",
                );
              });
            },
            "image/jpeg",
            CFG.JPEG_Q,
          );
        })
        .catch((err) => {
          if (_origGetCtx) HTMLCanvasElement.prototype.getContext = _origGetCtx;
          console.error(err);
          restoreAfterExport();
          templateEl.classList.remove("exporting");
          document.querySelector(".export-overlay").classList.add("hidden");
          alert("エクスポートに失敗しました: " + err.message);
        });
    }, 60);
  }

  /* DPI書き込み（JFIF APP0パッチ） */
  function setJpegDPI(bytes, dpi) {
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < bytes.length - 18; i++) {
      if (view.getUint8(i) === 0xff && view.getUint8(i + 1) === 0xe0) {
        const len = view.getUint16(i + 2);
        if (
          len >= 16 &&
          bytes[i + 4] === 0x4a &&
          bytes[i + 5] === 0x46 &&
          bytes[i + 6] === 0x49 &&
          bytes[i + 7] === 0x46 &&
          bytes[i + 8] === 0x00
        ) {
          view.setUint8(i + 11, 0x01);
          view.setUint16(i + 12, dpi);
          view.setUint16(i + 14, dpi);
          return bytes;
        }
      }
    }
    const app0 = new Uint8Array([
      0xff,
      0xe0,
      0x00,
      0x10,
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01,
      0x01,
      0x01,
      (dpi >> 8) & 0xff,
      dpi & 0xff,
      (dpi >> 8) & 0xff,
      dpi & 0xff,
      0x00,
      0x00,
    ]);
    const out = new Uint8Array(2 + app0.length + bytes.length - 2);
    out.set(bytes.slice(0, 2));
    out.set(app0, 2);
    out.set(bytes.slice(2), 2 + app0.length);
    return out;
  }

  /* ─────────────────────────────────
     ICC プロファイル埋め込み（APP2マーカー）
     P3対応ブラウザ → Display-P3 ICCでスマホ広色域写真を保持
     非対応ブラウザ  → sRGB ICCにフォールバック
     印刷会社のRIPが正確な色変換を行えるようにする。
     準拠: ICC.1:2001-04 (v2.1)
  ───────────────────────────────── */

  /**
   * ICC v2 プロファイルを構築する共通ビルダー
   * @param {string} desc  - プロファイル記述名
   * @param {number[]} rXYZ - 赤原色 D50適応済み [X, Y, Z]
   * @param {number[]} gXYZ - 緑原色 D50適応済み [X, Y, Z]
   * @param {number[]} bXYZ - 青原色 D50適応済み [X, Y, Z]
   * @returns {Uint8Array} 496バイトのICCプロファイル
   */
  function _buildICC(desc, rXYZ, gXYZ, bXYZ) {
    const buf = new Uint8Array(496);
    const dv = new DataView(buf.buffer);
    const w32 = (off, v) => dv.setUint32(off, v >>> 0, false);
    const w16 = (off, v) => dv.setUint16(off, v & 0xffff, false);
    const wSig = (off, s) => {
      for (let i = 0; i < 4; i++) buf[off + i] = s.charCodeAt(i);
    };
    const wF16 = (off, v) => w32(off, Math.round(v * 65536)); // s15Fixed16

    // ─── Header 128 bytes ───
    w32(0, 496); // profile size
    w32(8, 0x02100000); // ICC version 2.1.0.0
    wSig(12, "mntr"); // display device
    wSig(16, "RGB "); // input color space
    wSig(20, "XYZ "); // PCS
    w16(24, 1998);
    w16(26, 2);
    w16(28, 9);
    w16(30, 6);
    w16(32, 49);
    w16(34, 0);
    wSig(36, "acsp");
    w32(64, 0); // rendering intent: perceptual
    wF16(68, 0.96429);
    wF16(72, 1.0);
    wF16(76, 0.82513); // D50 illuminant

    // ─── Tag table (9 tags) ───
    w32(128, 9);
    const td = [
      ["desc", 240, 112],
      ["cprt", 352, 48],
      ["wtpt", 400, 20],
      ["rXYZ", 420, 20],
      ["gXYZ", 440, 20],
      ["bXYZ", 460, 20],
      ["rTRC", 480, 16],
      ["gTRC", 480, 16],
      ["bTRC", 480, 16],
    ];
    td.forEach(([sig, off, sz], i) => {
      wSig(132 + i * 12, sig);
      w32(136 + i * 12, off);
      w32(140 + i * 12, sz);
    });

    // ─── desc (offset 240, 112 bytes) ───
    wSig(240, "desc");
    w32(244, 0);
    w32(248, desc.length + 1);
    for (let i = 0; i < desc.length; i++) buf[252 + i] = desc.charCodeAt(i);

    // ─── cprt (offset 352, 48 bytes) ───
    wSig(352, "text");
    w32(356, 0);
    const cs = "CC0 - No Rights Reserved";
    for (let i = 0; i < cs.length; i++) buf[360 + i] = cs.charCodeAt(i);

    // ─── wtpt: D50 (offset 400) ───
    wSig(400, "XYZ ");
    w32(404, 0);
    wF16(408, 0.96429);
    wF16(412, 1.0);
    wF16(416, 0.82513);

    // ─── rXYZ (offset 420) ───
    wSig(420, "XYZ ");
    w32(424, 0);
    wF16(428, rXYZ[0]);
    wF16(432, rXYZ[1]);
    wF16(436, rXYZ[2]);

    // ─── gXYZ (offset 440) ───
    wSig(440, "XYZ ");
    w32(444, 0);
    wF16(448, gXYZ[0]);
    wF16(452, gXYZ[1]);
    wF16(456, gXYZ[2]);

    // ─── bXYZ (offset 460) ───
    wSig(460, "XYZ ");
    w32(464, 0);
    wF16(468, bXYZ[0]);
    wF16(472, bXYZ[1]);
    wF16(476, bXYZ[2]);

    // ─── TRC: gamma ≈2.2 (offset 480, shared by r/g/b) ───
    wSig(480, "curv");
    w32(484, 0);
    w32(488, 1);
    w16(492, 563); // u8Fixed8: 563/256 ≈ 2.199

    return buf;
  }

  /* sRGB (IEC 61966-2-1) — D50適応済み原色 */
  function buildSRGBProfile() {
    return _buildICC(
      "sRGB IEC61966-2.1",
      [0.43607, 0.22249, 0.01392], // red
      [0.38515, 0.71689, 0.09707], // green
      [0.14307, 0.06061, 0.71393],
    ); // blue
  }

  /* Display P3 (DCI-P3 primaries + D65 white + sRGB TRC) — D50適応済み原色
     iPhone 7+/Galaxy S21+/Pixel 7+ 等のスマホ写真標準 */
  function buildDisplayP3Profile() {
    return _buildICC(
      "Display P3",
      [0.51512, 0.2412, -0.00105], // red
      [0.29198, 0.69225, 0.04189], // green
      [0.1571, 0.06657, 0.78407],
    ); // blue
  }

  /**
   * JPEG に ICC プロファイルを APP2 マーカーとして埋め込む
   * @param {Uint8Array} bytes   - JPEG バイナリ
   * @param {Uint8Array} profile - ICCプロファイルデータ
   */
  function embedICCProfile(bytes, profile) {
    let insertAt = 2; // SOI の直後
    if (bytes[2] === 0xff && bytes[3] === 0xe0) {
      const app0Len = (bytes[4] << 8) | bytes[5];
      insertAt = 2 + 2 + app0Len;
    }

    const payload = new Uint8Array(14 + profile.length);
    const iccSig = "ICC_PROFILE\0";
    for (let i = 0; i < 12; i++) payload[i] = iccSig.charCodeAt(i);
    payload[12] = 1;
    payload[13] = 1;
    payload.set(profile, 14);

    const app2 = new Uint8Array(2 + 2 + payload.length);
    app2[0] = 0xff;
    app2[1] = 0xe2;
    const len = 2 + payload.length;
    app2[2] = (len >> 8) & 0xff;
    app2[3] = len & 0xff;
    app2.set(payload, 4);

    const out = new Uint8Array(bytes.length + app2.length);
    out.set(bytes.slice(0, insertAt));
    out.set(app2, insertAt);
    out.set(bytes.slice(insertAt), insertAt + app2.length);
    return out;
  }

  /* ─────────────────────────────────
     UTILS
  ───────────────────────────────── */
  function el(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs)
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === "className") e.className = v;
        else e[k] = v;
      });
    return e;
  }

  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  let notifyTimer;
  function notify(msg) {
    const n = document.getElementById("notify");
    if (!n) return;
    n.textContent = msg;
    n.classList.add("show");
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => n.classList.remove("show"), 2600);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
