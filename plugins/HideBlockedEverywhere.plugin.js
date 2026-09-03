/**
 * @name HideBlockedEverywhere
 * @description Hides blocked and ignored users everywhere in Discord.
 * @version 2.5.0
 * @author ht0912
 * @authorId 888369163389767720
 */

module.exports = class HideBlockedEverywhere {

  start() {
    this.blockedIds = new Set();
    this.injectStyle();
    this.loadBlockedIds();
    this.startObserver();
    this.processAll();
  }

  stop() {
    if (this.observer) this.observer.disconnect();
    if (this._raf) cancelAnimationFrame(this._raf);
    document.getElementById("hbe-style")?.remove();
    document.querySelectorAll("[data-hbe-hidden]").forEach(el =>
      el.removeAttribute("data-hbe-hidden")
    );
  }

  injectStyle() {
    const style = document.createElement("style");
    style.id = "hbe-style";
    style.textContent = `[data-hbe-hidden="true"] { display: none !important; }`;
    document.head.appendChild(style);
  }

  startObserver() {
    this.observer = new MutationObserver(() => {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.processAll());
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  loadBlockedIds() {
    try {
      const store = BdApi.Webpack.getStore("RelationshipStore");
      if (!store) return;
      this.blockedIds.clear();
      if (typeof store.getBlockedIDs === "function")
        store.getBlockedIDs().forEach(id => this.blockedIds.add(id));
      if (typeof store.getIgnoredIDs === "function")
        store.getIgnoredIDs().forEach(id => this.blockedIds.add(id));
      if (this.blockedIds.size === 0 && typeof store.getBlockedOrIgnoredIDs === "function")
        store.getBlockedOrIgnoredIDs().forEach(id => this.blockedIds.add(id));
    } catch (e) {
      console.error("[HBE] loadBlockedIds error:", e);
    }
  }

  // ─── React Fiber helpers ─────────────────────────────────────────────────────

  getFiber(el) {
    const key = Object.keys(el).find(k =>
      k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
    );
    return key ? el[key] : null;
  }

  getUserId(el) {
    try {
      const fiber = this.getFiber(el);
      if (!fiber) return null;

      // Đi lên
      let node = fiber;
      for (let i = 0; i < 30 && node; i++) {
        const uid = this.readId(node);
        if (uid) return uid;
        node = node.return;
      }

      // Đi xuống
      const search = (n, depth) => {
        if (!n || depth > 12) return null;
        const uid = this.readId(n);
        if (uid) return uid;
        return search(n.child, depth + 1) || search(n.sibling, depth + 1);
      };
      return search(fiber.child, 0);
    } catch (e) {}
    return null;
  }

  readId(node) {
    if (!node) return null;
    try {
      const p = node.memoizedProps || node.pendingProps;
      if (p) {
        if (p.user?.id)                                          return p.user.id;
        if (this.isSnowflake(p.userId))                          return p.userId;
        // Bỏ p.id vì dễ nhầm với message id, channel id, v.v.
        if (p.member?.user?.id)                                  return p.member.user.id;
        if (this.isSnowflake(p.activity?.user_id))               return p.activity.user_id;
        if (this.isSnowflake(p.authorId))                        return p.authorId;
        if (p.item?.user_id && this.isSnowflake(p.item.user_id)) return p.item.user_id;
        if (p.item?.user?.id)                                    return p.item.user.id;
        if (p.data?.user?.id)                                    return p.data.user.id;
        if (this.isSnowflake(p.data?.userId))                    return p.data.userId;
        if (p.entry?.author_id && this.isSnowflake(p.entry.author_id)) return p.entry.author_id;
        if (p.row?.entry?.author_id && this.isSnowflake(p.row.entry.author_id)) return p.row.entry.author_id;
      }
      const s = node.memoizedState;
      if (s?.user?.id) return s.user.id;
    } catch (e) {}
    return null;
  }

  isSnowflake(val) {
    return typeof val === "string" && /^\d{17,19}$/.test(val);
  }

  // ─── Process toàn bộ DOM ─────────────────────────────────────────────────────

  processAll() {
    this.loadBlockedIds();
    if (this.blockedIds.size === 0) return;

    const candidates = document.querySelectorAll(
      "li, article, [role='listitem'], [role='article'], " +
      "[class*='peopleListItem'], " +
      "[class*='member_'], " +
      "[class*='privateChannel'], " +
      "[class*='channel_'], " +
      "[class*='activityFeed'] > *, " +
      "[class*='feed_'] > *, " +
      "[class*='nowPlaying'] > *, " +
      "[class*='scroller_'] > li"
    );

    candidates.forEach(el => {
      // Bỏ qua nếu là message trong chat
      if (
        el.closest("[class*='messagesWrapper']") ||
        el.closest("[class*='chatContent']") ||
        el.closest("[class*='messageListItem']") ||
        el.id?.startsWith("chat-messages-")
      ) return;

      let uid = el.getAttribute("data-user-id")
        || el.querySelector("[data-user-id]")?.getAttribute("data-user-id");
      if (!uid) uid = this.getUserId(el);
      if (!uid) return;

      if (this.blockedIds.has(uid)) {
        el.setAttribute("data-hbe-hidden", "true");
      } else {
        el.removeAttribute("data-hbe-hidden");
      }
    });
  }
};
