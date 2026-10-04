// <uwu-status state="payment_done" size="160"></uwu-status>
//
// Shows one of UwU's seamless 60 fps status loops on a transparent background.
//   * Chrome, Edge, Firefox: WebM (VP9 with alpha) in a muted looping <video>,
//     512 px or 256 px depending on the displayed size.
//   * Safari (no VP9 alpha): the animated WebP version in an <img>.
//   * prefers-reduced-motion: the still poster PNG.
// Changing `state` crossfades to the new loop. Off-screen players pause.
//
// Attributes: state (see UwuStatus.STATES), size (px, default 160), src (folder that
// holds the loop files, default ./loops/ next to this script), label (aria label).

(() => {
  const STATES = {
    welcome: "مرحبًا",
    working: "جاري العمل",
    success: "تم بنجاح",
    payment_done: "تم الدفع",
    subscription: "الاشتراك المميز",
    offers: "العروض",
    login: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    connect_accounts: "ربط الحسابات",
    results: "النتائج",
    project_success: "نجاح المشروع",
    problem: "يوجد مشكلة",
    error404: "الصفحة غير موجودة",
    factory_problem: "مشكلة في المصنع",
    n8n_problem: "مشكلة ربط n8n",
    zapier_problem: "مشكلة ربط Zapier",
    albato_problem: "مشكلة ربط Albato",
    ai_idle: "المساعد — جاهز",
    ai_listening: "المساعد — يستمع",
    ai_thinking: "المساعد — يفكر",
    ai_speaking: "المساعد — يجيب",
    ai_error: "المساعد — خطأ",
  };

  const here = document.currentScript ? new URL("./loops/", document.currentScript.src).href : "./loops/";
  const ua = navigator.userAgent;
  const noVp9Alpha = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua);
  const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FADE = 160; // ms

  class UwuStatus extends HTMLElement {
    static get observedAttributes() { return ["state", "size", "src"]; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>
        :host { display: inline-block; position: relative; width: var(--uwu-size, 160px); aspect-ratio: 1; }
        .layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transition: opacity ${FADE}ms ease; }
        .layer.out { opacity: 0; }
      </style>`;
      this._current = null;
      this._io = null;
    }

    connectedCallback() {
      this.setAttribute("role", "img");
      this._applySize();
      this._show();
      if ("IntersectionObserver" in window) {
        this._io = new IntersectionObserver(([e]) => {
          const v = this._current;
          if (v && v.tagName === "VIDEO") e.isIntersecting ? v.play().catch(() => {}) : v.pause();
        });
        this._io.observe(this);
      }
    }

    disconnectedCallback() { if (this._io) this._io.disconnect(); }

    attributeChangedCallback(name, oldV, newV) {
      if (!this.isConnected || oldV === newV) return;
      if (name === "size") this._applySize();
      else this._show();
    }

    get state() { return this.getAttribute("state") || "welcome"; }
    set state(v) { this.setAttribute("state", v); }

    _applySize() {
      const s = this.getAttribute("size");
      if (s) this.style.setProperty("--uwu-size", /^\d+$/.test(s) ? s + "px" : s);
    }

    _make(state) {
      // window.UWU_STATUS_SOURCES = { state: { webm, webp, png } } overrides the file paths
      // (used by self-contained pages); window.UWU_STATUS_FORMAT = "webp" forces images.
      const base = (this.getAttribute("src") || here).replace(/\/?$/, "/") + state;
      const own = (window.UWU_STATUS_SOURCES || {})[state] || {};
      const url = (ext) => own[ext] || base + "." + ext;
      const forceImg = window.UWU_STATUS_FORMAT === "webp" || (own.webp && !own.webm);
      let el;
      if (reduced()) {
        el = document.createElement("img");
        el.src = own.png || own.webp || base + ".png";
      } else if (noVp9Alpha || forceImg) {
        el = document.createElement("img");
        el.src = url("webp");
      } else {
        el = document.createElement("video");
        Object.assign(el, { muted: true, loop: true, autoplay: true, playsInline: true, preload: "auto" });
        el.setAttribute("muted", "");
        el.setAttribute("playsinline", "");
        // the 256 px file is enough up to ~270 device pixels and decodes 4x cheaper
        const px = (this.getBoundingClientRect().width || parseFloat(this.getAttribute("size")) || 160) * (window.devicePixelRatio || 1);
        el.poster = url("png");
        el.src = px <= 270 ? own.webm256 || base + "-256.webm" : url("webm");
      }
      el.className = "layer out";
      el.alt = "";
      el.draggable = false;
      return el;
    }

    _show() {
      const state = STATES[this.state] ? this.state : "welcome";
      this.setAttribute("aria-label", this.getAttribute("label") || STATES[state]);
      if (this._current && this._current.dataset.state === state) return;
      const next = this._make(state), prev = this._current;
      next.dataset.state = state;
      this.shadowRoot.appendChild(next);
      this._current = next;
      const reveal = () => {
        requestAnimationFrame(() => next.classList.remove("out"));
        if (prev) { prev.classList.add("out"); setTimeout(() => prev.remove(), FADE + 40); }
      };
      if (next.tagName === "VIDEO") {
        next.addEventListener("loadeddata", reveal, { once: true });
        next.play().catch(() => {});
      } else if (next.complete) reveal();
      else next.addEventListener("load", reveal, { once: true });
    }
  }

  UwuStatus.STATES = STATES;
  window.UwuStatus = UwuStatus;
  if (!customElements.get("uwu-status")) customElements.define("uwu-status", UwuStatus);
})();
