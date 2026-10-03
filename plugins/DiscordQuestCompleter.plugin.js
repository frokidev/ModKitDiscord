/**
 * @name DiscordQuestCompleter
 * @version 1.0.0
 * @author Kiro
 * @description Tự động hoàn thành Discord Quests với giao diện trực quan. Hỗ trợ WATCH_VIDEO, PLAY_ON_DESKTOP, STREAM_ON_DESKTOP, PLAY_ACTIVITY.
 */

'use strict';

const { DOM, UI } = new BdApi("DiscordQuestCompleter");

const CSS = `
#dqc-panel {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 320px;
    background: #1e1f22;
    border: 1px solid #3a3b3e;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 9999;
    font-family: var(--font-primary, 'gg sans', sans-serif);
    color: #dbdee1;
    overflow: hidden;
    user-select: none;
}
#dqc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #2b2d31;
    cursor: pointer;
    border-bottom: 1px solid #3a3b3e;
}
#dqc-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
}
#dqc-header-left svg {
    flex-shrink: 0;
}
#dqc-toggle-collapse {
    background: none;
    border: none;
    color: #b5bac1;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    transition: color 0.2s;
}
#dqc-toggle-collapse:hover { color: #ffffff; }
#dqc-body {
    padding: 12px 16px;
}
#dqc-status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
    color: #b5bac1;
}
#dqc-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #80848e;
    flex-shrink: 0;
    transition: background 0.3s;
}
#dqc-status-dot.idle { background: #80848e; }
#dqc-status-dot.running { background: #23a55a; animation: dqc-pulse 1.5s infinite; }
#dqc-status-dot.done { background: #23a55a; }
#dqc-status-dot.error { background: #f23f42; }
@keyframes dqc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}
#dqc-quest-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 220px;
    overflow-y: auto;
    margin-bottom: 12px;
    scrollbar-width: thin;
    scrollbar-color: #3a3b3e transparent;
}
#dqc-quest-list:empty::after {
    content: 'Chưa có quest nào. Nhấn Quét để tìm.';
    display: block;
    text-align: center;
    color: #80848e;
    font-size: 12px;
    padding: 16px 0;
}
.dqc-quest-item {
    background: #2b2d31;
    border-radius: 8px;
    padding: 10px 12px;
    border: 1px solid #3a3b3e;
}
.dqc-quest-name {
    font-size: 13px;
    font-weight: 500;
    color: #ffffff;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.dqc-quest-type {
    font-size: 11px;
    color: #b5bac1;
    margin-bottom: 6px;
}
.dqc-progress-bar-bg {
    height: 4px;
    background: #3a3b3e;
    border-radius: 2px;
    overflow: hidden;
}
.dqc-progress-bar-fill {
    height: 100%;
    background: #5865f2;
    border-radius: 2px;
    transition: width 0.5s ease;
}
.dqc-progress-bar-fill.done { background: #23a55a; }
.dqc-quest-progress-text {
    font-size: 11px;
    color: #b5bac1;
    margin-top: 4px;
    text-align: right;
}
#dqc-buttons {
    display: flex;
    gap: 8px;
}
.dqc-btn {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: filter 0.15s;
}
.dqc-btn:hover { filter: brightness(1.15); }
.dqc-btn:active { filter: brightness(0.9); }
.dqc-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
#dqc-btn-scan { background: #4e5058; color: #ffffff; }
#dqc-btn-start { background: #5865f2; color: #ffffff; }
#dqc-btn-stop { background: #f23f42; color: #ffffff; display: none; }
#dqc-log {
    margin-top: 10px;
    max-height: 80px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #3a3b3e transparent;
}
.dqc-log-line {
    font-size: 11px;
    color: #b5bac1;
    padding: 1px 0;
    line-height: 1.4;
}
.dqc-log-line.success { color: #23a55a; }
.dqc-log-line.error { color: #f23f42; }
.dqc-log-line.info { color: #5865f2; }
`;

module.exports = class DiscordQuestCompleter {
    constructor() {
        this._panel = null;
        this._collapsed = false;
        this._quests = [];
        this._running = false;
        this._stopFlag = false;
        this._questStates = new Map(); // questId -> {progress, needed, done}
    }

    start() {
        DOM.addStyle("DiscordQuestCompleter-css", CSS);
        this._buildPanel();
        this._log("Plugin đã khởi động. Nhấn Quét để tìm quest.", "info");
    }

    stop() {
        this._stopFlag = true;
        if (this._panel) this._panel.remove();
        DOM.removeStyle("DiscordQuestCompleter-css");
    }

    // ── UI BUILD ─────────────────────────────────────────────────────────────

    _buildPanel() {
        const panel = document.createElement("div");
        panel.id = "dqc-panel";
        panel.innerHTML = `
            <div id="dqc-header">
                <div id="dqc-header-left">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#faa61a"/>
                    </svg>
                    Quest Completer
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                    <button id="dqc-btn-stop-header" style="display:none;background:#f23f42;color:#fff;border:none;border-radius:5px;padding:3px 10px;font-size:12px;font-weight:600;cursor:pointer;">⏹ Dừng</button>
                    <button id="dqc-toggle-collapse">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div id="dqc-body">
                <div id="dqc-status-bar">
                    <div id="dqc-status-dot" class="idle"></div>
                    <span id="dqc-status-text">Sẵn sàng</span>
                </div>
                <div id="dqc-quest-list"></div>
                <div id="dqc-buttons">
                    <button class="dqc-btn" id="dqc-btn-scan">🔍 Quét</button>
                    <button class="dqc-btn" id="dqc-btn-start">▶ Bắt đầu</button>
                </div>
                <div id="dqc-buttons-2" style="margin-top:6px">
                    <button class="dqc-btn" id="dqc-btn-stop" style="width:100%;background:#f23f42;color:#fff">⏹ Dừng</button>
                </div>
                <div id="dqc-log"></div>
            </div>
        `;
        document.body.appendChild(panel);
        this._panel = panel;

        // Events
        panel.querySelector("#dqc-toggle-collapse").addEventListener("click", () => this._toggleCollapse());
        panel.querySelector("#dqc-btn-scan").addEventListener("click", () => this._scanQuests());
        panel.querySelector("#dqc-btn-start").addEventListener("click", () => this._startAll());
        panel.querySelector("#dqc-btn-stop").addEventListener("click", () => this._stop());
        panel.querySelector("#dqc-btn-stop-header").addEventListener("click", () => this._stop());

        // Ẩn nút stop và bắt đầu ban đầu
        panel.querySelector("#dqc-btn-start").style.display = "none";
        panel.querySelector("#dqc-buttons-2").style.display = "none";

        // Drag
        this._makeDraggable(panel, panel.querySelector("#dqc-header"));
    }

    _makeDraggable(el, handle) {
        let ox = 0, oy = 0, mx = 0, my = 0;
        handle.addEventListener("mousedown", e => {
            if (e.target.closest("button")) return;
            e.preventDefault();
            ox = el.offsetLeft; oy = el.offsetTop;
            mx = e.clientX; my = e.clientY;
            const move = e2 => {
                el.style.right = "auto";
                el.style.bottom = "auto";
                el.style.left = (ox + e2.clientX - mx) + "px";
                el.style.top = (oy + e2.clientY - my) + "px";
            };
            const up = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
            };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        });
    }

    _toggleCollapse() {
        this._collapsed = !this._collapsed;
        const body = this._panel.querySelector("#dqc-body");
        const icon = this._panel.querySelector("#dqc-toggle-collapse svg path");
        body.style.display = this._collapsed ? "none" : "";
        icon.setAttribute("d", this._collapsed ? "M7 14l5-5 5 5z" : "M7 10l5 5 5-5z");
    }

    // ── QUEST SCAN ───────────────────────────────────────────────────────────

    _scanQuests() {
        this._log("Đang quét quest...", "info");
        this._setStatus("running", "Đang quét...");

        try {
            const wpRequire = this._getWpRequire();
            if (!wpRequire) {
                this._log("Không tìm thấy webpack. Hãy đảm bảo bạn đang ở Discord.", "error");
                this._setStatus("error", "Lỗi webpack");
                return;
            }

            const QuestsStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
            if (!QuestsStore) {
                this._log("Không tìm thấy QuestsStore.", "error");
                this._setStatus("error", "Không tìm thấy store");
                return;
            }

            const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
            this._quests = [...QuestsStore.quests.values()].filter(x =>
                x.userStatus?.enrolledAt &&
                !x.userStatus?.completedAt &&
                new Date(x.config.expiresAt).getTime() > Date.now() &&
                supportedTasks.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y))
            );

            this._wpRequire = wpRequire;
            this._renderQuestList();

            if (this._quests.length === 0) {
                this._log("Không có quest nào chưa hoàn thành.", "error");
                this._setStatus("idle", "Không có quest");
                this._panel.querySelector("#dqc-btn-start").style.display = "none";
            } else {
                this._log(`Tìm thấy ${this._quests.length} quest có thể hoàn thành.`, "success");
                this._setStatus("idle", `${this._quests.length} quest sẵn sàng`);
                this._panel.querySelector("#dqc-btn-start").style.display = "";
            }
        } catch(e) {
            this._log("Lỗi khi quét: " + e.message, "error");
            this._setStatus("error", "Lỗi");
        }
    }

    _renderQuestList() {
        const list = this._panel.querySelector("#dqc-quest-list");
        list.innerHTML = "";
        const typeLabel = {
            WATCH_VIDEO: "🎬 Xem video",
            WATCH_VIDEO_ON_MOBILE: "📱 Xem video (mobile)",
            PLAY_ON_DESKTOP: "🎮 Chơi game",
            STREAM_ON_DESKTOP: "📡 Stream",
            PLAY_ACTIVITY: "🎯 Activity",
        };
        for (const quest of this._quests) {
            const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
            const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
            const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
            const taskData = taskConfig.tasks[taskName];
            const secondsNeeded = taskData.target;
            const secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
            const pct = Math.min(100, Math.round(secondsDone / secondsNeeded * 100));

            const item = document.createElement("div");
            item.className = "dqc-quest-item";
            item.dataset.questId = quest.id;
            item.innerHTML = `
                <div class="dqc-quest-name" title="${quest.config.messages.questName}">${quest.config.messages.questName}</div>
                <div class="dqc-quest-type">${typeLabel[taskName] ?? taskName}</div>
                <div class="dqc-progress-bar-bg">
                    <div class="dqc-progress-bar-fill ${pct >= 100 ? 'done' : ''}" style="width:${pct}%"></div>
                </div>
                <div class="dqc-quest-progress-text">${Math.floor(secondsDone)}/${secondsNeeded}s (${pct}%)</div>
            `;
            list.appendChild(item);
            this._questStates.set(quest.id, { progress: secondsDone, needed: secondsNeeded, taskName });
        }
    }

    _updateQuestProgress(questId, progress, needed) {
        const item = this._panel?.querySelector(`.dqc-quest-item[data-quest-id="${questId}"]`);
        if (!item) return;
        const pct = Math.min(100, Math.round(progress / needed * 100));
        const fill = item.querySelector(".dqc-progress-bar-fill");
        const text = item.querySelector(".dqc-quest-progress-text");
        fill.style.width = pct + "%";
        if (pct >= 100) fill.classList.add("done");
        text.textContent = `${Math.floor(progress)}/${needed}s (${pct}%)`;
    }

    // ── QUEST RUNNER ─────────────────────────────────────────────────────────

    async _startAll() {
        if (this._running) return;
        this._running = true;
        this._stopFlag = false;
        this._panel.querySelector("#dqc-btn-start").style.display = "none";
        this._panel.querySelector("#dqc-btn-scan").disabled = true;
        this._panel.querySelector("#dqc-buttons-2").style.display = "";
        this._panel.querySelector("#dqc-btn-stop-header").style.display = "";
        this._setStatus("running", "Đang chạy...");

        const questsCopy = [...this._quests];
        for (const quest of questsCopy) {
            if (this._stopFlag) break;
            await this._runQuest(quest);
        }

        this._running = false;
        this._panel.querySelector("#dqc-btn-start").style.display = "";
        this._panel.querySelector("#dqc-btn-scan").disabled = false;
        this._panel.querySelector("#dqc-buttons-2").style.display = "none";
        this._panel.querySelector("#dqc-btn-stop-header").style.display = "none";

        if (!this._stopFlag) {
            this._setStatus("done", "Hoàn thành!");
            this._log("Tất cả quest đã hoàn thành! Vào Nhiệm vụ để nhận thưởng.", "success");
        }
    }

    _stop() {
        this._stopFlag = true;
        this._running = false;
        this._setStatus("idle", "Đã dừng");
        this._log("Đã dừng.", "error");
        this._panel.querySelector("#dqc-btn-start").style.display = "";
        this._panel.querySelector("#dqc-btn-scan").disabled = false;
        this._panel.querySelector("#dqc-buttons-2").style.display = "none";
        this._panel.querySelector("#dqc-btn-stop-header").style.display = "none";
    }

    async _runQuest(quest) {
        const wpRequire = this._wpRequire;
        const api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;
        const FluxDispatcher = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
        const RunningGameStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
        const ApplicationStreamingStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
        const ChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
        const GuildChannelStore = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;

        const isApp = typeof DiscordNative !== "undefined";
        const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];
        const taskConfig = quest.config.taskConfig ?? quest.config.taskConfigV2;
        const taskName = supportedTasks.find(x => taskConfig.tasks[x] != null);
        const taskData = taskConfig.tasks[taskName];
        const applicationId = quest.config.application?.id ?? taskData.applications?.[0]?.id;
        const secondsNeeded = taskData.target;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
        const questName = quest.config.messages.questName;
        const pid = Math.floor(Math.random() * 30000) + 1000;

        this._log(`Bắt đầu: "${questName}" (${taskName})`, "info");

        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
            const speed = 7;
            let completed = false;
            await new Promise(resolve => {
                const fn = async () => {
                    while (!this._stopFlag) {
                        const remaining = Math.min(speed, secondsNeeded - secondsDone);
                        await this._sleep(remaining * 1000);
                        if (this._stopFlag) break;
                        const timestamp = secondsDone + speed;
                        const res = await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) } });
                        completed = res.body.completed_at != null;
                        secondsDone = Math.min(secondsNeeded, timestamp);
                        this._updateQuestProgress(quest.id, secondsDone, secondsNeeded);
                        if (timestamp >= secondsNeeded) break;
                    }
                    if (!completed && !this._stopFlag) {
                        await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
                    }
                    this._log(`✅ Hoàn thành: "${questName}"`, "success");
                    resolve();
                };
                fn();
            });

        } else if (taskName === "PLAY_ON_DESKTOP") {
            if (!isApp) {
                this._log(`⚠️ "${questName}" cần Discord Desktop App!`, "error");
                return;
            }
            await new Promise(async resolve => {
                const res = await api.get({ url: `/applications/public?application_ids=${applicationId}` });
                const appData = res.body[0];
                const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? appData.name.replace(/[\/\\:*?"<>|]/g, "");
                const fakeGame = {
                    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                    exeName, exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                    hidden: false, isLauncher: false, id: applicationId,
                    name: appData.name, pid, pidPath: [pid],
                    processName: appData.name, start: Date.now(),
                };
                const realGames = RunningGameStore.getRunningGames();
                const fakeGames = [fakeGame];
                const realGetRunningGames = RunningGameStore.getRunningGames;
                const realGetGameForPID = RunningGameStore.getGameForPID;
                RunningGameStore.getRunningGames = () => fakeGames;
                RunningGameStore.getGameForPID = (p) => fakeGames.find(x => x.pid === p);
                FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames });

                const fn = data => {
                    if (this._stopFlag) {
                        RunningGameStore.getRunningGames = realGetRunningGames;
                        RunningGameStore.getGameForPID = realGetGameForPID;
                        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        resolve();
                        return;
                    }
                    const progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
                    this._updateQuestProgress(quest.id, progress, secondsNeeded);
                    this._log(`Progress: ${progress}/${secondsNeeded}s`, "");
                    if (progress >= secondsNeeded) {
                        RunningGameStore.getRunningGames = realGetRunningGames;
                        RunningGameStore.getGameForPID = realGetGameForPID;
                        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        this._log(`✅ Hoàn thành: "${questName}"`, "success");
                        resolve();
                    }
                };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                this._log(`🎮 Giả lập game: "${appData.name}". Chờ ~${Math.ceil((secondsNeeded - secondsDone) / 60)} phút...`, "info");
            });

        } else if (taskName === "STREAM_ON_DESKTOP") {
            if (!isApp) {
                this._log(`⚠️ "${questName}" cần Discord Desktop App!`, "error");
                return;
            }
            await new Promise(resolve => {
                const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({ id: applicationId, pid, sourceName: null });
                const fn = data => {
                    if (this._stopFlag) {
                        ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        resolve(); return;
                    }
                    const progress = quest.config.configVersion === 1 ? data.userStatus.streamProgressSeconds : Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
                    this._updateQuestProgress(quest.id, progress, secondsNeeded);
                    if (progress >= secondsNeeded) {
                        ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        this._log(`✅ Hoàn thành: "${questName}"`, "success");
                        resolve();
                    }
                };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                this._log(`📡 Stream bất kỳ cửa sổ trong VC. Cần ít nhất 1 người trong kênh!`, "info");
            });

        } else if (taskName === "PLAY_ACTIVITY") {
            const channelId = ChannelStore.getSortedPrivateChannels()[0]?.id ?? Object.values(GuildChannelStore.getAllGuilds()).find(x => x != null && x.VOCAL?.length > 0)?.VOCAL[0]?.channel?.id;
            if (!channelId) { this._log("Không tìm thấy kênh voice!", "error"); return; }
            const streamKey = `call:${channelId}:1`;
            await new Promise(async resolve => {
                while (!this._stopFlag) {
                    const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
                    const progress = res.body.progress.PLAY_ACTIVITY.value;
                    this._updateQuestProgress(quest.id, progress, secondsNeeded);
                    this._log(`Progress: ${Math.floor(progress)}/${secondsNeeded}s`, "");
                    await this._sleep(20 * 1000);
                    if (progress >= secondsNeeded) {
                        await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
                        break;
                    }
                }
                this._log(`✅ Hoàn thành: "${questName}"`, "success");
                resolve();
            });
        }
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    _getWpRequire() {
        try {
            delete window.$;
            const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
            webpackChunkdiscord_app.pop();
            return wpRequire;
        } catch (e) {
            return null;
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _setStatus(type, text) {
        const dot = this._panel?.querySelector("#dqc-status-dot");
        const label = this._panel?.querySelector("#dqc-status-text");
        if (dot) { dot.className = ""; dot.classList.add(type); }
        if (label) label.textContent = text;
    }

    _log(msg, type = "") {
        const log = this._panel?.querySelector("#dqc-log");
        if (!log) return;
        const line = document.createElement("div");
        line.className = "dqc-log-line" + (type ? " " + type : "");
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        // Giữ tối đa 30 dòng
        while (log.children.length > 30) log.removeChild(log.firstChild);
    }
};
