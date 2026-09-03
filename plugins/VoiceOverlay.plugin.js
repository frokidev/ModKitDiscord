/**
 * @name VoiceOverlay
 * @description Always-visible voice channel overlay inside Discord.
 * @version 1.5.0
 * @author ht0912
 * @authorId 888369163389767720
 */

'use strict';

const { Data } = new BdApi("VoiceOverlay");

const VoiceStateStore  = BdApi.Webpack.getStore("VoiceStateStore");
const SpeakingStore    = BdApi.Webpack.getStore("SpeakingStore");
const UserStore        = BdApi.Webpack.getStore("UserStore");
const GuildMemberStore = BdApi.Webpack.getStore("GuildMemberStore");
const ChannelStore     = BdApi.Webpack.getStore("ChannelStore");
const AvatarUtils      = BdApi.Webpack.getByKeys("getUserAvatarURL");
const CurrentUserUtils = BdApi.Webpack.getByKeys("getCurrentUser");

const MAX_USERS = 5;

const POSITIONS = {
    "top-left":     { top: "8px",    left: "8px",  bottom: "auto", right: "auto" },
    "top-right":    { top: "8px",    right: "8px", bottom: "auto", left: "auto"  },
    "bottom-left":  { bottom: "8px", left: "8px",  top: "auto",    right: "auto" },
    "bottom-right": { bottom: "8px", right: "8px", top: "auto",    left: "auto"  },
};

const SVG_MUTED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,80,80,0.95)"><path d="M6.7 11H5C5 15.31 8.14 18.9 12.35 19.38v2.86h1.31V19.38C16.62 18.63 19 15.28 19 11h-1.7c0 3.69-2.62 6.45-5.3 6.45S6.7 14.69 6.7 11Z"/><path d="M12 15c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v7c0 1.66 1.34 3 3 3Z"/><line x1="2" y1="2" x2="22" y2="22" stroke="rgba(255,80,80,0.95)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const SVG_DEAF  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,80,80,0.95)"><path d="M12 2C6.486 2 2 6.488 2 12v8a1 1 0 0 0 1 1h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H4v-2c0-4.411 3.589-8 8-8s8 3.589 8 8v2h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-8c0-5.512-4.486-10-10-10z"/><line x1="2" y1="2" x2="22" y2="22" stroke="rgba(255,80,80,0.95)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const SVG_VIDEO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><path d="M21.526 8.149C21.231 7.966 20.862 7.951 20.553 8.105L18 9.382V7C18 5.897 17.103 5 16 5H4C2.897 5 2 5.897 2 7V17C2 18.103 2.897 19 4 19H16C17.103 19 18 18.103 18 17V14.618L20.553 15.895C20.694 15.965 20.847 16 21 16C21.183 16 21.366 15.949 21.526 15.851C21.82 15.668 22 15.347 22 15V9C22 8.653 21.82 8.332 21.526 8.149Z"/></svg>`;

module.exports = class VoiceOverlay {

    start() {
        this._cfg = Object.assign(
            { position: "top-left", showAvatars: true, showSpeakingGlow: true, offsetX: 8, offsetY: 8 },
            Data.load("settings") ?? {}
        );
        this._lastSpoke    = {};
        this._currentUsers = [];
        this._injectStyles();
        this._buildOverlay();

        this._onVoiceChange = () => this._render();
        this._onSpeakChange = () => this._updateSpeaking();
        VoiceStateStore.addChangeListener(this._onVoiceChange);
        SpeakingStore?.addChangeListener(this._onSpeakChange);
        this._interval = setInterval(() => this._render(), 3000);
    }

    stop() {
        clearInterval(this._interval);
        VoiceStateStore.removeChangeListener(this._onVoiceChange);
        SpeakingStore?.removeChangeListener(this._onSpeakChange);
        document.getElementById("vo-overlay")?.remove();
        document.getElementById("vo-style")?.remove();
    }

    getSettingsPanel() {
        const wrap = document.createElement("div");
        wrap.style.cssText = "padding:16px;display:flex;flex-direction:column;gap:16px;font-family:var(--font-primary);color:var(--header-primary);font-size:14px;";

        const posTitle = document.createElement("div");
        posTitle.style.cssText = "font-weight:700;margin-bottom:8px;";
        posTitle.textContent = "Position";
        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:6px;";
        const refreshBtns = () => {
            grid.querySelectorAll("button").forEach(b => {
                const on = b.dataset.v === this._cfg.position;
                b.style.cssText = `border:2px solid ${on?"#5865f2":"rgba(255,255,255,0.1)"};border-radius:6px;padding:7px 10px;cursor:pointer;font-size:13px;font-weight:${on?"700":"400"};background:${on?"rgba(88,101,242,0.2)":"var(--background-secondary)"};color:${on?"#fff":"var(--text-muted)"};text-align:left;`;
            });
        };
        [
            { v: "top-left",     l: "↖ Top Left"     },
            { v: "top-right",    l: "↗ Top Right"    },
            { v: "bottom-left",  l: "↙ Bottom Left"  },
            { v: "bottom-right", l: "↘ Bottom Right" },
        ].forEach(({ v, l }) => {
            const btn = document.createElement("button");
            btn.dataset.v = v; btn.textContent = l;
            btn.addEventListener("click", () => {
                this._cfg.position = v; this._save(); this._applyPosition(); refreshBtns();
            });
            grid.appendChild(btn);
        });
        setTimeout(refreshBtns, 0);
        const posGroup = document.createElement("div");
        posGroup.appendChild(posTitle); posGroup.appendChild(grid);

        const makeSwitch = (labelText, key) => {
            const row = document.createElement("div");
            row.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
            const lbl = document.createElement("span"); lbl.textContent = labelText; lbl.style.fontWeight = "500";
            const btn = document.createElement("button");
            const update = () => {
                const on = this._cfg[key];
                btn.textContent = on ? "ON" : "OFF";
                btn.style.cssText = `border:none;border-radius:12px;padding:4px 14px;cursor:pointer;font-size:12px;font-weight:700;background:${on?"#3ba55d":"rgba(255,255,255,0.1)"};color:${on?"#fff":"var(--text-muted)"};`;
            };
            update();
            btn.addEventListener("click", () => { this._cfg[key]=!this._cfg[key]; this._save(); update(); this._render(); });
            row.appendChild(lbl); row.appendChild(btn);
            return row;
        };

        const makeOffsetInput = (label, key) => {
            const col = document.createElement("div");
            col.style.cssText = "display:flex;flex-direction:column;gap:4px;flex:1;";
            const lbl = document.createElement("label"); lbl.textContent = label;
            lbl.style.cssText = "font-size:12px;color:var(--text-muted);";
            const input = document.createElement("input");
            input.type="number"; input.min="0"; input.max="2000"; input.value=this._cfg[key]??8;
            input.style.cssText = "background:var(--background-secondary);color:var(--header-primary);border:1px solid var(--background-tertiary);border-radius:4px;padding:5px 8px;font-size:13px;width:100%;box-sizing:border-box;";
            input.addEventListener("change", () => { this._cfg[key]=Math.max(0,parseInt(input.value)||0); this._save(); this._applyPosition(); });
            col.appendChild(lbl); col.appendChild(input);
            return col;
        };

        const offsetTitle = document.createElement("div");
        offsetTitle.style.cssText = "font-weight:700;margin-bottom:8px;";
        offsetTitle.textContent = "Offset (px)";
        const offsetRow = document.createElement("div");
        offsetRow.style.cssText = "display:flex;gap:10px;";
        offsetRow.appendChild(makeOffsetInput("Horizontal (X)", "offsetX"));
        offsetRow.appendChild(makeOffsetInput("Vertical (Y)", "offsetY"));
        const offsetGroup = document.createElement("div");
        offsetGroup.appendChild(offsetTitle); offsetGroup.appendChild(offsetRow);

        wrap.appendChild(posGroup);
        wrap.appendChild(makeSwitch("Show avatars", "showAvatars"));
        wrap.appendChild(makeSwitch("Speaking glow", "showSpeakingGlow"));
        wrap.appendChild(offsetGroup);
        return wrap;
    }

    _buildOverlay() {
        document.getElementById("vo-overlay")?.remove();
        const el = document.createElement("div");
        el.id = "vo-overlay";
        el.style.display = "none";
        this._applyPosition(el);
        document.body.appendChild(el);
        this._render();
    }

    _applyPosition(el) {
        const target = el ?? document.getElementById("vo-overlay");
        if (!target) return;
        const base = POSITIONS[this._cfg.position] ?? POSITIONS["top-left"];
        const pos  = { ...base };
        const ox = `${this._cfg.offsetX ?? 8}px`;
        const oy = `${this._cfg.offsetY ?? 8}px`;
        if (pos.left   !== "auto") pos.left   = ox;
        if (pos.right  !== "auto") pos.right  = ox;
        if (pos.top    !== "auto") pos.top    = oy;
        if (pos.bottom !== "auto") pos.bottom = oy;
        Object.assign(target.style, pos);
    }

    _isSpeaking(userId) {
        try { return SpeakingStore?.isSpeaking?.(userId) ?? false; }
        catch { return false; }
    }

    _updateSpeaking() {
        const overlay = document.getElementById("vo-overlay");
        if (!overlay) return;
        const now = Date.now();
        this._currentUsers.forEach(uid => {
            const speaking = this._isSpeaking(uid);
            if (speaking) this._lastSpoke[uid] = now;
            const el = overlay.querySelector(`[data-uid="${uid}"]`);
            if (!el) return;
            speaking ? el.classList.add("vo-speaking") : el.classList.remove("vo-speaking");
        });
        const me = CurrentUserUtils?.getCurrentUser?.();
        if (!me) return;
        const myState = VoiceStateStore.getVoiceStateForUser(me.id);
        if (!myState?.channelId) return;
        const states = VoiceStateStore.getVoiceStatesForChannel(myState.channelId) ?? {};
        const newSpeaker = Object.keys(states).find(uid => this._isSpeaking(uid) && !this._currentUsers.includes(uid));
        if (newSpeaker) this._render();
    }

    _render() {
        const overlay = document.getElementById("vo-overlay");
        if (!overlay) return;
        const me = CurrentUserUtils?.getCurrentUser?.();
        if (!me) return;

        const myState   = VoiceStateStore.getVoiceStateForUser(me.id);
        const channelId = myState?.channelId;

        if (!channelId) {
            overlay.style.display = "none";
            overlay.innerHTML = "";
            this._currentUsers = [];
            return;
        }

        overlay.style.display = "block";
        const channel = ChannelStore?.getChannel?.(channelId);
        const guildId = myState?.guildId;
        const states  = VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {};
        const now     = Date.now();
        const allIds  = Object.keys(states);

        allIds.forEach(uid => { if (this._isSpeaking(uid)) this._lastSpoke[uid] = now; });
        const speaking = allIds.filter(uid =>  this._isSpeaking(uid));
        const silent   = allIds.filter(uid => !this._isSpeaking(uid));
        speaking.sort((a, b) => (this._lastSpoke[b] ?? 0) - (this._lastSpoke[a] ?? 0));
        const visible = [...speaking, ...silent].slice(0, MAX_USERS);
        this._currentUsers = visible;

        let html = `<div class="vo-header"><span>🔊</span><span class="vo-ch-name">${this._esc(channel?.name ?? "Voice")}</span></div><div class="vo-list">`;

        visible.forEach(uid => {
            const state      = states[uid];
            const user       = UserStore.getUser(uid);
            if (!user) return;
            const member     = guildId ? GuildMemberStore?.getMember?.(guildId, uid) : null;
            const name       = member?.nick ?? user.globalName ?? user.username ?? "Unknown";
            const isSpeaking = this._isSpeaking(uid);
            const selfMuted  = state.selfMute || state.mute;
            const selfDeaf   = state.selfDeaf || state.deaf;
            const selfVideo  = state.selfVideo;
            const isMe       = uid === me.id;

            let avatarUrl;
            try {
                avatarUrl = AvatarUtils?.getUserAvatarURL
                    ? AvatarUtils.getUserAvatarURL(user, false, 64)
                    : (user.avatar
                        ? `https://cdn.discordapp.com/avatars/${uid}/${user.avatar}.webp?size=64`
                        : `https://cdn.discordapp.com/embed/avatars/0.png`);
            } catch { avatarUrl = `https://cdn.discordapp.com/embed/avatars/0.png`; }

            const speakCls = (isSpeaking && this._cfg.showSpeakingGlow) ? " vo-speaking" : "";
            const muteCls  = selfMuted ? " vo-muted" : "";
            const meTag    = isMe ? `<span class="vo-me">you</span>` : "";
            let icons = "";
            if (selfMuted && !selfDeaf) icons += `<span class="vo-icon">${SVG_MUTED}</span>`;
            if (selfDeaf)               icons += `<span class="vo-icon">${SVG_DEAF}</span>`;
            if (selfVideo)              icons += `<span class="vo-icon">${SVG_VIDEO}</span>`;

            html += `<div class="vo-user${speakCls}${muteCls}" data-uid="${uid}">`;
            if (this._cfg.showAvatars)
                html += `<div class="vo-aw"><img class="vo-av" src="${avatarUrl}" alt=""></div>`;
            html += `<span class="vo-name">${this._esc(name)}${meTag}</span>`;
            if (icons) html += `<span class="vo-icons">${icons}</span>`;
            html += `</div>`;
        });

        html += `</div>`;
        overlay.innerHTML = html;
    }

    _save() { Data.save("settings", this._cfg); }

    _esc(s) {
        return String(s ?? "")
            .replace(/&/g,"&amp;").replace(/</g,"&lt;")
            .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    _injectStyles() {
        document.getElementById("vo-style")?.remove();
        const s = document.createElement("style");
        s.id = "vo-style";
        s.textContent = `
#vo-overlay {
    position: fixed;
    z-index: 9000;
    padding: 4px 0;
    min-width: 180px;
    max-width: 230px;
    font-family: var(--font-primary, 'gg sans', sans-serif);
    user-select: none;
    pointer-events: none;
}
.vo-header {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 5px;
    padding: 3px 10px;
    background: rgba(0,0,0,0.72);
    border-radius: 5px;
    width: fit-content;
}
.vo-ch-name {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: rgba(255,255,255,0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}
.vo-list { display:flex; flex-direction:column; gap:3px; }
.vo-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(0,0,0,0.68);
    opacity: 0.78;
}
.vo-speaking {
    opacity: 1 !important;
    background: rgba(0,0,0,0.82) !important;
}
.vo-aw {
    position: relative;
    flex-shrink: 0;
    width: 30px; height: 30px;
}
.vo-aw::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2.5px solid #23a559;
    opacity: 0;
    transition: opacity 0.18s ease;
    pointer-events: none;
}
.vo-speaking .vo-aw::after { opacity: 1; }
.vo-av {
    width: 30px; height: 30px;
    border-radius: 50%;
    object-fit: cover;
    display: block;
}
.vo-muted .vo-av { filter: grayscale(60%); opacity: 0.65; }
.vo-name {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.92);
    text-shadow: 0 1px 4px rgba(0,0,0,1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    transition: color 0.18s ease;
}
.vo-speaking .vo-name { color: #fff; }
.vo-me {
    font-size: 9px;
    background: rgba(88,101,242,0.55);
    color: #c9cbff;
    border-radius: 3px;
    padding: 1px 4px;
    margin-left: 4px;
    vertical-align: middle;
    font-weight: 700;
}
.vo-icons { display:flex; align-items:center; gap:2px; flex-shrink:0; }
.vo-icon  { display:flex; align-items:center; width:16px; height:16px; }
        `;
        document.head.appendChild(s);
    }
};
