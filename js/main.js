/**
 * 音ノ彼方 / 彩月かなた — Official Website
 * main.js: 背景の星・浮遊する淡い光（精霊）のCanvas演出、および初期化処理
 */

(function () {
  'use strict';

  // 動作軽減設定（アニメーションを抑える設定）の確認
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // DOMContentLoaded時の初期化
  document.addEventListener('DOMContentLoaded', () => {
    initForestCanvas();
  });

  // ページ読み込み完了時にフェードイン表示を適用
  window.addEventListener('load', () => {
    // わずかな遅延を置いて自然に森が広がる感覚を演出
    setTimeout(() => {
      document.body.classList.add('is-loaded');
    }, 150);
  });

  /**
   * 背景の星空・浮遊する光（精霊）を制御するCanvas
   */
  function initForestCanvas() {
    const canvas = document.getElementById('forest-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = null;

    // マウス位置（PCでの緩やかな反応用）
    const mouse = { x: -1000, y: -1000, isHovering: false };

    // 光の精霊の色定義（淡いシアン・月光ブルー・淡い金色）
    const spiritColors = [
      { r: 140, g: 245, b: 225 }, // 淡いシアン（青緑）
      { r: 170, g: 215, b: 255 }, // 月光ブルー
      { r: 255, g: 240, b: 170 }, // 淡い黄金
      { r: 190, g: 235, b: 245 }  // 透き通る白青
    ];

    let stars = [];
    let spirits = [];

    // キャンバスのリサイズ処理
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      ctx.scale(dpr, dpr);

      initElements();
    }

    // 星と精霊（浮遊する光）の生成
    function initElements() {
      const isMobile = width < 768;

      // 1. 星の生成（画面サイズに応じて数を調整）
      const starCount = isMobile ? 35 : 75;
      stars = [];
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.75), // 空から木々の上部に散りばめる
          radius: Math.random() * 1.2 + 0.4,
          baseAlpha: Math.random() * 0.6 + 0.2,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleAngle: Math.random() * Math.PI * 2
        });
      }

      // 2. 精霊（抽象的な光の球）の生成
      // スマホでは文字の邪魔をしないよう数を控えめに（5個）、PCは12個
      const spiritCount = isMobile ? 5 : 12;
      spirits = [];
      for (let i = 0; i < spiritCount; i++) {
        const color = spiritColors[Math.floor(Math.random() * spiritColors.length)];
        spirits.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.85 + (height * 0.1),
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.25 - 0.05, // ほんの少し上向きに漂いやすい
          radius: Math.random() * 2.5 + 2.0,       // 中心光の半径
          glowMultiplier: Math.random() * 6 + 7,   // 光彩の広がり倍率
          color: color,
          alpha: Math.random() * 0.4 + 0.4,
          pulseSpeed: Math.random() * 0.015 + 0.008,
          pulseAngle: Math.random() * Math.PI * 2,
          wanderAngle: Math.random() * Math.PI * 2,
          wanderSpeed: Math.random() * 0.01 + 0.005
        });
      }
    }

    // 星の描画と更新
    function drawStars() {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!prefersReducedMotion) {
          s.twinkleAngle += s.twinkleSpeed;
        }
        const currentAlpha = Math.max(0.1, s.baseAlpha + Math.sin(s.twinkleAngle) * 0.3);

        ctx.fillStyle = `rgba(225, 240, 255, ${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 精霊（淡い光）の描画と更新
    function drawSpirits() {
      for (let i = 0; i < spirits.length; i++) {
        const sp = spirits[i];

        if (!prefersReducedMotion) {
          // ふわふわとたゆたう自然な揺らぎ（ランダムな風の影響）
          sp.wanderAngle += (Math.random() - 0.5) * 0.1;
          sp.vx += Math.cos(sp.wanderAngle) * 0.015;
          sp.vy += Math.sin(sp.wanderAngle) * 0.015;

          // 速度制限（速くなりすぎないように制御）
          const maxSpeed = 0.45;
          const speed = Math.sqrt(sp.vx * sp.vx + sp.vy * sp.vy);
          if (speed > maxSpeed) {
            sp.vx = (sp.vx / speed) * maxSpeed;
            sp.vy = (sp.vy / speed) * maxSpeed;
          }

          // マウスカーソルに対する穏やかな反応（近づくと少しだけ道を譲るように避ける）
          if (mouse.isHovering) {
            const dx = sp.x - mouse.x;
            const dy = sp.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const avoidDist = 120;
            if (dist < avoidDist && dist > 0) {
              const force = (avoidDist - dist) / avoidDist;
              sp.vx += (dx / dist) * force * 0.15;
              sp.vy += (dy / dist) * force * 0.15;
            }
          }

          sp.x += sp.vx;
          sp.y += sp.vy;

          // 画面端を越えたときのゆるやかなループ
          const padding = 60;
          if (sp.x < -padding) sp.x = width + padding;
          if (sp.x > width + padding) sp.x = -padding;
          if (sp.y < -padding) sp.y = height + padding;
          if (sp.y > height + padding) sp.y = -padding;

          // 呼吸するような明滅
          sp.pulseAngle += sp.pulseSpeed;
        }

        const currentAlpha = Math.max(0.15, sp.alpha + Math.sin(sp.pulseAngle) * 0.25);
        const glowRadius = sp.radius * sp.glowMultiplier;

        // 外側のやわらかな光彩（グラデーション）
        const glow = ctx.createRadialGradient(
          sp.x, sp.y, 0,
          sp.x, sp.y, glowRadius
        );
        const { r, g, b } = sp.color;
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${currentAlpha})`);
        glow.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.5})`);
        glow.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${currentAlpha * 0.12})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 中心の明るい光核
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, currentAlpha + 0.2)})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // アニメーションループ
    function render() {
      ctx.clearRect(0, 0, width, height);

      drawStars();
      drawSpirits();

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    }

    // イベントリスナー設定
    window.addEventListener('resize', resize);

    // PCでのマウスホバー検知
    if (window.innerWidth >= 768) {
      window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.isHovering = true;
      });

      window.addEventListener('mouseleave', () => {
        mouse.isHovering = false;
        mouse.x = -1000;
        mouse.y = -1000;
      });
    }

    // 初期起動
    resize();
    render();
  }
})();
